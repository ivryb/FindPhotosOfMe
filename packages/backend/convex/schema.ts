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
    // Bytes of photos and thumbnails in R2, for pricing storage extensions
    storedBytes: v.optional(v.number()),
    // Legacy per-gallery plans; migrations.moveToBalance clears them. Remove once it has run in production.
    plan: v.optional(
      v.union(v.literal("demo"), v.literal("event"), v.literal("large"))
    ),
    photoLimit: v.optional(v.number()),
    expiresAt: v.optional(v.number()),
    // Created before the owner's first top-up; that top-up extends it to the full included time
    trial: v.optional(v.boolean()),
    // Whether anyone with the link can browse every photo, or only the previews. Unset means every photo.
    showAllPhotos: v.optional(v.boolean()),
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
    error: v.optional(v.union(v.literal("no_face"), v.literal("failed"))),
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
    // Photos with faces that were kept; the rest are returned to the owner's balance
    savedImages: v.optional(v.number()),
    // Counts dispatches, so a retried upload is charged again while a replayed one is not
    attempt: v.optional(v.number()),
    error: v.optional(v.string()),
    workId: v.optional(v.string()),
    createdAt: v.number(),
    startedAt: v.optional(v.number()),
    finishedAt: v.optional(v.number()),
  })
    .index("by_collection", ["collectionId"])
    .index("by_collection_and_status", ["collectionId", "status"]),

  // Money in mills (thousandths of a dollar). Every change to a balance is an entry.
  balances: defineTable({
    userId: v.string(),
    credit: v.number(),
    // Has topped up at least once; new galleries then get the full included time
    paid: v.boolean(),
  }).index("by_user", ["userId"]),

  balanceEntries: defineTable({
    userId: v.string(),
    amount: v.number(),
    reason: v.union(
      v.literal("trial"),
      v.literal("top_up"),
      v.literal("top_up_refund"),
      v.literal("photos"),
      v.literal("photos_returned"),
      v.literal("search"),
      v.literal("search_returned"),
      v.literal("storage"),
      v.literal("migration"),
      // Credit added by hand, such as the admin's own before payments open
      v.literal("grant")
    ),
    collectionId: v.optional(v.id("collections")),
    // The job, search, or order this entry belongs to; one entry per source and reason
    sourceId: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_source", ["sourceId", "reason"]),

  paymentOrders: defineTable({
    providerOrderId: v.string(),
    // Legacy plan orders belong to a gallery; top-ups belong to the account
    collectionId: v.optional(v.id("collections")),
    userId: v.string(),
    plan: v.optional(v.union(v.literal("event"), v.literal("large"))),
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
