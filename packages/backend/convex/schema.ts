import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/** One upload: a ZIP, or photos chosen together. The browser sends its photos in batches; workers process each batch. */
export const uploadFields = {
  collectionId: v.id("collections"),
  contributorKey: v.optional(v.string()),
  // Name and size identify the upload, so adding the same ZIP again continues it
  name: v.string(),
  size: v.number(),
  photos: v.number(),
  // Photos the browser has sent, processed, kept, and given up on
  sent: v.number(),
  processed: v.number(),
  saved: v.number(),
  failed: v.number(),
};

export const batchStatus = v.union(
  // Credit is held while its fixed set of upload URLs is usable; nothing has been charged yet
  v.literal("staging"),
  v.literal("pending"),
  v.literal("running"),
  // Its faces are in their own file, waiting to be merged into the gallery's face index
  v.literal("done"),
  v.literal("merged"),
  // Given up after its tries; its photos were refunded
  v.literal("failed")
);

export default defineSchema({
  todos: defineTable({
    text: v.string(),
    completed: v.boolean(),
  }),

  collections: defineTable({
    subdomain: v.optional(v.string()),
    sharing: v.optional(v.union(v.literal("link"), v.literal("subdomain"))),
    shareToken: v.optional(v.string()),
    crowdsource: v.optional(v.boolean()),
    // Existing galleries keep their public links; new galleries explicitly start private.
    published: v.optional(v.boolean()),
    title: v.string(),
    description: v.string(),
    status: v.union(
      v.literal("not_started"),
      v.literal("processing"),
      v.literal("complete"),
      v.literal("error")
    ),
    imagesCount: v.number(),
    // Bytes of photos and thumbnails in R2, for pricing storage
    storedBytes: v.optional(v.number()),
    // Legacy per-gallery plans; migrations.moveToBalance clears them. Remove once it has run in production.
    plan: v.optional(
      v.union(v.literal("demo"), v.literal("event"), v.literal("large"))
    ),
    photoLimit: v.optional(v.number()),
    // When the gallery goes offline; the owner chooses it. Unset means it stays online.
    expiresAt: v.optional(v.number()),
    // Until when storage is paid: the included time, then each day balances.chargeStorage takes.
    // Unset on galleries from before daily storage, whose time was paid up to expiresAt.
    storagePaidUntil: v.optional(v.number()),
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
    telegramBotUsername: v.optional(v.string()),
    // Custom welcome message for Telegram bot (supports {IMAGES_COUNT} template)
    welcomeMessage: v.optional(v.string()),
    // When a worker started merging finished batches into the face index; one merge runs at a time
    mergingSince: v.optional(v.number()),
  })
    .index("by_status", ["status"])
    .index("by_subdomain", ["subdomain"])
    .index("by_share_token", ["shareToken"])
    .index("by_created_by", ["createdBy"])
    .index("by_merging_since", ["mergingSince"])
    .index("by_expires_at", ["expiresAt"]),

  telegramSessions: defineTable({
    collectionId: v.id("collections"),
    chatId: v.string(),
    shareToken: v.optional(v.string()),
    contributorKey: v.string(),
    mode: v.union(v.literal("search"), v.literal("upload")),
    lastUploadGroup: v.optional(v.string()),
  }).index("by_collection_chat", ["collectionId", "chatId"]),

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

  uploads: defineTable(uploadFields).index("by_collection", ["collectionId"]).index("by_contributor", ["collectionId", "contributorKey"]),

  // Up to 50 photos of an upload: the unit of work one processing worker takes on
  uploadBatches: defineTable({
    collectionId: v.id("collections"),
    uploadId: v.id("uploads"),
    names: v.array(v.string()),
    // Older, already queued batches use upload-ID storage paths and have no staging metadata.
    staging: v.optional(v.object({
      first: v.number(), sizes: v.array(v.number()), expiresAt: v.number(),
      // A legacy gallery can acquire an owner after this batch starts; only release credit actually held.
      reservedBy: v.optional(v.string()),
    })),
    // Rejected photos are refunded after their upload URLs expire and staging storage is deleted.
    refundPending: v.optional(v.number()),
    keepAllPhotos: v.optional(v.boolean()),
    status: batchStatus,
    attempts: v.number(),
    startedAt: v.optional(v.number()),
  })
    .index("by_status", ["status"])
    .index("by_refund_pending", ["refundPending"])
    .index("by_collection_and_status", ["collectionId", "status"])
    .index("by_upload", ["uploadId"]),

  // Legacy ZIP jobs from before uploads were sent photo by photo. Nothing reads them; delete the rows, then this table.
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
    // Held by staging batches. Existing balances without holds omit this field.
    reserved: v.optional(v.number()),
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
