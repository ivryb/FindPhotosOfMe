import { v } from "convex/values";

import { internal } from "./_generated/api";
import { action, httpAction, internalMutation } from "./_generated/server";
import { authComponent } from "./auth";
import { applyEntry, balanceFor, endTrial, findEntry } from "./balances";
import { DAY, MAXIMUM_TOP_UP, MINIMUM_TOP_UP, formatMoney } from "./pricing";

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

/** Opens a Lemon Squeezy checkout that adds `amount` (in mills) to the signed-in account's balance. */
export const createTopUp = action({
  args: { amount: v.number() },
  handler: async (ctx, { amount }): Promise<string> => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new Error("Not authenticated");
    const cents = Math.round(amount / 10);
    if (cents * 10 < MINIMUM_TOP_UP || cents * 10 > MAXIMUM_TOP_UP) {
      throw new Error(`Top up between ${formatMoney(MINIMUM_TOP_UP)} and ${formatMoney(MAXIMUM_TOP_UP)}`);
    }

    const variantId = requiredEnv("LEMONSQUEEZY_TOP_UP_VARIANT_ID");
    const siteUrl = requiredEnv("SITE_URL").replace(/\/$/, "");
    const response = await fetch("https://api.lemonsqueezy.com/v1/checkouts", {
      method: "POST",
      headers: {
        Accept: "application/vnd.api+json",
        Authorization: `Bearer ${requiredEnv("LEMONSQUEEZY_API_KEY")}`,
        "Content-Type": "application/vnd.api+json",
      },
      body: JSON.stringify({
        data: {
          type: "checkouts",
          attributes: {
            custom_price: cents,
            product_options: {
              enabled_variants: [Number(variantId)],
              redirect_url: `${siteUrl}/admin?top_up=success`,
              receipt_button_text: "Back to your galleries",
              receipt_link_url: `${siteUrl}/admin`,
            },
            checkout_options: { embed: false, media: false, logo: true },
            checkout_data: { email: user.email, name: user.name, custom: { user_id: user._id } },
            expires_at: new Date(Date.now() + DAY).toISOString(),
            test_mode: process.env.LEMONSQUEEZY_TEST_MODE === "true",
          },
          relationships: {
            store: { data: { type: "stores", id: requiredEnv("LEMONSQUEEZY_STORE_ID") } },
            variant: { data: { type: "variants", id: variantId } },
          },
        },
      }),
    });
    const result = await response.json();
    const url = result?.data?.attributes?.url;
    if (!response.ok || !url) throw new Error("Could not open checkout");
    return url;
  },
});

/** Credits a paid order to its buyer's balance: `subtotal` is the US cents paid before tax; `total` is in the order's currency. */
export const recordTopUp = internalMutation({
  args: {
    providerOrderId: v.string(),
    userId: v.string(),
    variantId: v.string(),
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
      variantId: args.variantId,
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

export const recordRefund = internalMutation({
  args: {
    providerOrderId: v.string(),
    refundedAmount: v.number(),
    full: v.boolean(),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db
      .query("paymentOrders")
      .withIndex("by_provider_order", (q) => q.eq("providerOrderId", args.providerOrderId))
      .unique();
    if (!order) throw new Error("Order not found");
    await ctx.db.patch(order._id, {
      status: args.full ? "refunded" : "partial_refund",
      refundedAmount: args.refundedAmount,
      updatedAt: Date.now(),
    });

    // Legacy plan orders bought one gallery; a full refund takes that gallery offline.
    if (order.collectionId) {
      const collection = await ctx.db.get(order.collectionId);
      if (args.full && collection?.lemonsqueezyOrderId === args.providerOrderId) {
        await ctx.db.patch(order.collectionId, { paymentStatus: "refunded" });
      }
      return;
    }

    // A top-up refund takes back the refunded share of its credit; the balance may go below zero.
    // Each webhook carries the running refunded total, so the refund entry is raised to match it.
    const credited = await findEntry(ctx, args.providerOrderId, "top_up");
    if (!credited || !order.amount) return;
    const owed = Math.round(credited.amount * Math.min(args.refundedAmount, order.amount) / order.amount);
    const previous = await findEntry(ctx, args.providerOrderId, "top_up_refund");
    const more = owed - (previous ? -previous.amount : 0);
    if (more <= 0) return;
    if (!previous) {
      await applyEntry(ctx, { userId: order.userId, amount: -more, reason: "top_up_refund", sourceId: args.providerOrderId });
      return;
    }
    const balance = await balanceFor(ctx, order.userId);
    await ctx.db.patch(previous._id, { amount: -owed });
    await ctx.db.patch(balance._id, { credit: balance.credit - more });
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

export const webhook = httpAction(async (ctx, request) => {
  const body = await request.text();
  const signature = request.headers.get("x-signature") ?? "";
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  if (!secret || !(await validSignature(body, signature, secret))) {
    return new Response("Invalid signature", { status: 401 });
  }

  const payload = JSON.parse(body);
  const eventName = request.headers.get("x-event-name") ?? payload?.meta?.event_name;
  const order = payload?.data;
  const attributes = order?.attributes;
  if (order?.type !== "orders" || !attributes) return new Response("Ignored", { status: 200 });
  if (String(attributes.store_id) !== requiredEnv("LEMONSQUEEZY_STORE_ID")) {
    return new Response("Wrong store", { status: 400 });
  }

  if (eventName === "order_created") {
    const custom = payload?.meta?.custom_data;
    const productId = String(attributes.first_order_item?.product_id ?? "");
    if (!custom?.user_id || productId !== requiredEnv("LEMONSQUEEZY_PRODUCT_ID") || attributes.status !== "paid") {
      return new Response("Invalid order", { status: 400 });
    }
    // Every paid order credits its buyer's balance, including plan checkouts opened before balances existed.
    await ctx.runMutation(internal.payments.recordTopUp, {
      providerOrderId: String(order.id),
      userId: String(custom.user_id),
      variantId: String(attributes.first_order_item?.variant_id ?? ""),
      // What the buyer paid before tax, in US cents: discounts aren't credited, and other currencies are converted.
      subtotal: Number(attributes.subtotal_usd ?? attributes.subtotal) - Number(attributes.discount_total_usd ?? attributes.discount_total ?? 0),
      total: Number(attributes.total),
      currency: String(attributes.currency),
      testMode: Boolean(attributes.test_mode),
      purchasedAt: Date.parse(attributes.created_at) || Date.now(),
    });
  } else if (eventName === "order_refunded") {
    await ctx.runMutation(internal.payments.recordRefund, {
      providerOrderId: String(order.id),
      refundedAmount: Number(attributes.refunded_amount ?? 0),
      full: attributes.status === "refunded" || attributes.refunded === true,
    });
  }

  return new Response("OK", { status: 200 });
});
