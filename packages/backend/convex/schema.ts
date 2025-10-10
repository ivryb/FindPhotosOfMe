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
    // First 50 image keys for previews
    previewImages: v.optional(v.array(v.string())),
    createdBy: v.optional(v.string()), // User ID or identifier
    // Optional Telegram bot token for this collection
    telegramBotToken: v.optional(v.string()),
    // Custom welcome message for Telegram bot (supports {IMAGES_COUNT} template)
    welcomeMessage: v.optional(v.string()),
  })
    .index("by_status", ["status"])
    .index("by_subdomain", ["subdomain"]),

  searchRequests: defineTable({
    collectionId: v.id("collections"),
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
  }).index("by_collection", ["collectionId"]),
});
