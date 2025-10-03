import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
	todos: defineTable({
		text: v.string(),
		completed: v.boolean(),
	}),
	events: defineTable({
		subdomain: v.string(),
		title: v.string(),
		description: v.string(),
	}).index("by_subdomain", ["subdomain"]),
});
