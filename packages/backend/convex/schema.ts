import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  todos: defineTable({
    text: v.string(),
    completed: v.boolean(),
  }),

  collections: defineTable({
    subdomain: v.string(),
    title: v.string(),
    description: v.string(),
    status: v.union(
      v.literal("not_started"),
      v.literal("processing"),
      v.literal("complete"),
      v.literal("error")
    ),
    imagesCount: v.number(),
    plan: v.optional(
      v.union(v.literal("demo"), v.literal("event"), v.literal("large"))
    ),
    photoLimit: v.optional(v.number()),
    expiresAt: v.optional(v.number()),
    paymentStatus: v.optional(
      v.union(v.literal("active"), v.literal("refunded"))
    ),
    lemonsqueezyOrderId: v.optional(v.string()),
    // First 50 image keys for previews
    previewImages: v.optional(v.array(v.string())),
    createdBy: v.optional(v.string()), // User ID or identifier
    // Optional Telegram bot token for this collection
    telegramBotToken: v.optional(v.string()),
    // Custom welcome message for Telegram bot (supports {IMAGES_COUNT} template)
    welcomeMessage: v.optional(v.string()),
  })
    .index("by_status", ["status"])
    .index("by_subdomain", ["subdomain"])
    .index("by_created_by", ["createdBy"]),

  searchRequests: defineTable({
    collectionId: v.id("collections"),
    requesterId: v.optional(v.string()),
    publicAccess: v.optional(v.boolean()),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("complete"),
      v.literal("error")
    ),
    imagesFound: v.array(v.string()), // Array of R2 paths
    totalImages: v.optional(v.number()),
    processedImages: v.optional(v.number()),
    // Optional Telegram chat id to notify results
    telegramChatId: v.optional(v.string()),
  }).index("by_collection", ["collectionId"]),

  ingestJobs: defineTable({
    collectionId: v.id("collections"),
    fileKey: v.string(),
    filename: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("failed"),
      v.literal("completed"),
      v.literal("canceled")
    ),
    totalImages: v.optional(v.number()),
    processedImages: v.number(),
    error: v.optional(v.string()),
    workId: v.optional(v.string()),
    createdAt: v.number(),
    startedAt: v.optional(v.number()),
    finishedAt: v.optional(v.number()),
  })
    .index("by_collection", ["collectionId"])
    .index("by_collection_and_status", ["collectionId", "status"]),

  paymentOrders: defineTable({
    providerOrderId: v.string(),
    collectionId: v.id("collections"),
    userId: v.string(),
    plan: v.union(v.literal("event"), v.literal("large")),
    variantId: v.string(),
    status: v.union(
      v.literal("paid"),
      v.literal("partial_refund"),
      v.literal("refunded")
    ),
    amount: v.number(),
    refundedAmount: v.optional(v.number()),
    currency: v.string(),
    testMode: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_provider_order", ["providerOrderId"])
    .index("by_collection", ["collectionId"]),
});
