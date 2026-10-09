import { v } from "convex/values";

import { internal } from "./_generated/api";
import { action, httpAction, internalMutation } from "./_generated/server";
import { authComponent } from "./auth";
import { applyEntry, endTrial, findEntry } from "./balances";
import { MAXIMUM_TOP_UP, MINIMUM_TOP_UP, formatMoney } from "./pricing";

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

/** Opens a Creem checkout that adds `amount` (in mills) to the signed-in account's balance. */
export const createTopUp = action({
  args: { amount: v.number() },
  handler: async (ctx, { amount }): Promise<string> => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new Error("Not authenticated");
    const cents = Math.round(amount / 10);
    if (cents * 10 < MINIMUM_TOP_UP || cents * 10 > MAXIMUM_TOP_UP) {
      throw new Error(`Top up between ${formatMoney(MINIMUM_TOP_UP)} and ${formatMoney(MAXIMUM_TOP_UP)}`);
    }

    const apiKey = requiredEnv("CREEM_API_KEY");
    // Test keys only work against Creem's sandbox.
    const api = apiKey.startsWith("creem_test_") ? "https://test-api.creem.io" : "https://api.creem.io";
    const siteUrl = requiredEnv("SITE_URL").replace(/\/$/, "");
    const response = await fetch(`${api}/v1/checkouts`, {
      method: "POST",
      headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        product_id: requiredEnv("CREEM_PRODUCT_ID"),
        // The product is priced before tax, so the buyer pays this plus any tax, and this is what gets credited.
        custom_price: cents,
        customer: { email: user.email },
        success_url: `${siteUrl}/admin?top_up=success`,
        metadata: { userId: user._id },
      }),
    });
    const result = await response.json();
    if (!response.ok || !result?.checkout_url) throw new Error("Could not open checkout");
    return result.checkout_url as string;
  },
});

/** Credits a paid order to its buyer's balance: `subtotal` is the US cents paid before tax; `total` includes tax. */
export const recordTopUp = internalMutation({
  args: {
    providerOrderId: v.string(),
    userId: v.string(),
    subtotal: v.number(),
    total: v.number(),
    currency: v.string(),
    testMode: v.boolean(),
    purchasedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("paymentOrders")
      .withIndex("by_provider_order", (q) => q.eq("providerOrderId", args.providerOrderId))
      .unique();
    if (existing) return existing._id;

    const id = await ctx.db.insert("paymentOrders", {
      providerOrderId: args.providerOrderId,
      userId: args.userId,
      status: "paid",
      amount: args.total,
      currency: args.currency,
      testMode: args.testMode,
      createdAt: args.purchasedAt,
      updatedAt: Date.now(),
    });
    await applyEntry(ctx, { userId: args.userId, amount: args.subtotal * 10, reason: "top_up", sourceId: args.providerOrderId });

    await endTrial(ctx, args.userId);
    return id;
  },
});

/** Takes back the refunded share of an order's credit; the balance may go below zero. `amount` is in the order's cents, with tax. */
export const recordRefund = internalMutation({
  args: { providerOrderId: v.string(), refundId: v.string(), amount: v.number() },
  handler: async (ctx, { providerOrderId, refundId, amount }) => {
    if (await findEntry(ctx, refundId, "top_up_refund")) return;
    const order = await ctx.db
      .query("paymentOrders")
      .withIndex("by_provider_order", (q) => q.eq("providerOrderId", providerOrderId))
      .unique();
    const credited = await findEntry(ctx, providerOrderId, "top_up");
    // Throwing makes Creem retry, which covers a refund delivered before its order.
    if (!order || !credited) throw new Error("Order not found");

    // Each refund carries only its own amount, so the order keeps the running total. Taking the difference of
    // shares keeps several partial refunds from rounding past what was credited.
    // A fully discounted order paid nothing, so it has nothing to take back.
    const share = (refunded: number) => order.amount ? Math.round(credited.amount * Math.min(refunded, order.amount) / order.amount) : 0;
    const before = order.refundedAmount ?? 0;
    const after = before + amount;
    await ctx.db.patch(order._id, { status: after >= order.amount ? "refunded" : "partial_refund", refundedAmount: after, updatedAt: Date.now() });
    await applyEntry(ctx, { userId: order.userId, amount: share(before) - share(after), reason: "top_up_refund", sourceId: refundId });
  },
});

async function validSignature(body: string, signature: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const bytes = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body))
  );
  const expected = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  if (expected.length !== signature.length) return false;
  let difference = 0;
  for (let index = 0; index < expected.length; index++) {
    difference |= expected.charCodeAt(index) ^ signature.charCodeAt(index);
  }
  return difference === 0;
}

/**
 * Creem's payment events. Test and live mode have separate products and webhook secrets, so checking both keeps
 * test payments, which anyone can make with a test card, from crediting a live deployment.
 */
export const webhook = httpAction(async (ctx, request) => {
  const body = await request.text();
  const secret = process.env.CREEM_WEBHOOK_SECRET;
  if (!secret || !(await validSignature(body, request.headers.get("creem-signature") ?? "", secret))) {
    return new Response("Invalid signature", { status: 401 });
  }

  const { eventType, object } = JSON.parse(body);
  const order = object?.order;
  if (eventType !== "checkout.completed" && eventType !== "refund.created") return new Response("Ignored", { status: 200 });
  if (order?.product !== requiredEnv("CREEM_PRODUCT_ID")) return new Response("Wrong product", { status: 400 });

  if (eventType === "checkout.completed") {
    const userId = object.metadata?.userId;
    if (!userId || order.status !== "paid") return new Response("Invalid order", { status: 400 });
    await ctx.runMutation(internal.payments.recordTopUp, {
      providerOrderId: String(order.id),
      userId: String(userId),
      subtotal: Number(order.amount_paid) - Number(order.tax_amount ?? 0),
      total: Number(order.amount_paid),
      currency: String(order.currency),
      testMode: order.mode !== "prod",
      purchasedAt: Date.parse(order.created_at) || Date.now(),
    });
  } else {
    await ctx.runMutation(internal.payments.recordRefund, {
      providerOrderId: String(order.id),
      refundId: String(object.id),
      amount: Number(object.refund_amount),
    });
  }
  return new Response("OK", { status: 200 });
});
