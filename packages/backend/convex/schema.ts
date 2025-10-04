import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
	todos: defineTable({
		text: v.string(),
		completed: v.boolean(),
	}),
	
	collections: defineTable({
		name: v.string(),
		status: v.union(
			v.literal("not_started"),
			v.literal("processing"),
			v.literal("complete"),
			v.literal("error")
		),
		imagesCount: v.number(),
		createdBy: v.optional(v.string()), // User ID or identifier
	}).index("by_status", ["status"]),
	
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
	}).index("by_collection", ["collectionId"]),
});
