import { v } from "convex/values";

import { api, internal } from "./_generated/api";
import { action, httpAction, internalMutation } from "./_generated/server";
import { authComponent } from "./auth";

const DAY = 24 * 60 * 60 * 1000;
const paidPlan = v.union(v.literal("event"), v.literal("large"));

const PLANS = {
  event: { days: 60, photoLimit: 5_000, variantEnv: "LEMONSQUEEZY_EVENT_VARIANT_ID" },
  large: { days: 90, photoLimit: 20_000, variantEnv: "LEMONSQUEEZY_LARGE_EVENT_VARIANT_ID" },
} as const;

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function planForVariant(variantId: string) {
  return (Object.entries(PLANS) as [keyof typeof PLANS, (typeof PLANS)[keyof typeof PLANS]][])
    .find(([, config]) => process.env[config.variantEnv] === variantId)?.[0];
}

export const createCheckout = action({
  args: { collectionId: v.id("collections"), plan: paidPlan },
  handler: async (ctx, { collectionId, plan }): Promise<string> => {
    const [user, collection] = await Promise.all([
      authComponent.getAuthUser(ctx),
      ctx.runQuery(api.collections.get, { id: collectionId }),
    ]);
    if (!user) throw new Error("Not authenticated");
    if (collection.paymentStatus === "refunded") {
      throw new Error("This event was refunded and cannot be repurchased");
    }
    if (collection.plan && collection.plan !== "demo") {
      throw new Error("This event already has a paid plan");
    }

    const variantId = requiredEnv(PLANS[plan].variantEnv);
    const storeId = requiredEnv("LEMONSQUEEZY_STORE_ID");
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
            product_options: {
              enabled_variants: [Number(variantId)],
              redirect_url: `${siteUrl}/admin/collections/${collection.subdomain}?checkout=success`,
              receipt_button_text: "Manage event",
              receipt_link_url: `${siteUrl}/admin/collections/${collection.subdomain}`,
            },
            checkout_options: { embed: false, media: false, logo: true },
            checkout_data: {
              email: user.email,
              name: user.name,
              custom: {
                collection_id: collectionId,
                user_id: user._id,
              },
            },
            expires_at: new Date(Date.now() + DAY).toISOString(),
            test_mode: process.env.LEMONSQUEEZY_TEST_MODE === "true",
          },
          relationships: {
            store: { data: { type: "stores", id: storeId } },
            variant: { data: { type: "variants", id: variantId } },
          },
        },
      }),
    });
    const result = await response.json();
    const url = result?.data?.attributes?.url;
    if (!response.ok || !url) throw new Error("Could not create checkout");
    return url;
  },
});

export const recordOrder = internalMutation({
  args: {
    providerOrderId: v.string(),
    collectionId: v.id("collections"),
    userId: v.string(),
    plan: paidPlan,
    variantId: v.string(),
    amount: v.number(),
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

    const collection = await ctx.db.get(args.collectionId);
    if (!collection || collection.createdBy !== args.userId) throw new Error("Invalid collection owner");
    if (collection.lemonsqueezyOrderId && collection.lemonsqueezyOrderId !== args.providerOrderId) {
      throw new Error("Collection already has a different order");
    }

    const config = PLANS[args.plan];
    const now = Date.now();
    const id = await ctx.db.insert("paymentOrders", {
      providerOrderId: args.providerOrderId,
      collectionId: args.collectionId,
      userId: args.userId,
      plan: args.plan,
      variantId: args.variantId,
      status: "paid",
      amount: args.amount,
      currency: args.currency,
      testMode: args.testMode,
      createdAt: args.purchasedAt,
      updatedAt: now,
    });
    await ctx.db.patch(args.collectionId, {
      plan: args.plan,
      photoLimit: config.photoLimit,
      expiresAt: args.purchasedAt + config.days * DAY,
      paymentStatus: "active",
      lemonsqueezyOrderId: args.providerOrderId,
    });
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
    if (args.full) {
      const collection = await ctx.db.get(order.collectionId);
      if (collection?.lemonsqueezyOrderId === args.providerOrderId) {
        await ctx.db.patch(order.collectionId, { paymentStatus: "refunded" });
      }
    }
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
    const variantId = String(attributes.first_order_item?.variant_id ?? "");
    const plan = planForVariant(variantId);
    if (
      !custom?.collection_id ||
      !custom?.user_id ||
      productId !== requiredEnv("LEMONSQUEEZY_PRODUCT_ID") ||
      !plan ||
      attributes.status !== "paid"
    ) {
      return new Response("Invalid order", { status: 400 });
    }
    await ctx.runMutation(internal.payments.recordOrder, {
      providerOrderId: String(order.id),
      collectionId: custom.collection_id,
      userId: String(custom.user_id),
      plan,
      variantId,
      amount: Number(attributes.total),
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
