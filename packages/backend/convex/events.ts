import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getAll = query({
	args: {},
	returns: v.array(
		v.object({
			_id: v.id("events"),
			_creationTime: v.number(),
			subdomain: v.string(),
			title: v.string(),
			description: v.string(),
		})
	),
	handler: async (ctx) => {
		return await ctx.db.query("events").collect();
	},
});

export const getById = query({
	args: {
		id: v.id("events"),
	},
	returns: v.union(
		v.object({
			_id: v.id("events"),
			_creationTime: v.number(),
			subdomain: v.string(),
			title: v.string(),
			description: v.string(),
		}),
		v.null()
	),
	handler: async (ctx, args) => {
		return await ctx.db.get(args.id);
	},
});

export const getBySubdomain = query({
	args: {
		subdomain: v.string(),
	},
	returns: v.union(
		v.object({
			_id: v.id("events"),
			_creationTime: v.number(),
			subdomain: v.string(),
			title: v.string(),
			description: v.string(),
		}),
		v.null()
	),
	handler: async (ctx, args) => {
		return await ctx.db
			.query("events")
			.withIndex("by_subdomain", (q) => q.eq("subdomain", args.subdomain))
			.first();
	},
});

export const create = mutation({
	args: {
		subdomain: v.string(),
		title: v.string(),
		description: v.string(),
	},
	returns: v.id("events"),
	handler: async (ctx, args) => {
		// Check if subdomain already exists
		const existing = await ctx.db
			.query("events")
			.withIndex("by_subdomain", (q) => q.eq("subdomain", args.subdomain))
			.first();

		if (existing) {
			throw new Error("An event with this subdomain already exists");
		}

		const newEventId = await ctx.db.insert("events", {
			subdomain: args.subdomain,
			title: args.title,
			description: args.description,
		});

		return newEventId;
	},
});

export const update = mutation({
	args: {
		id: v.id("events"),
		subdomain: v.string(),
		title: v.string(),
		description: v.string(),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		// Check if the event exists
		const event = await ctx.db.get(args.id);
		if (!event) {
			throw new Error("Event not found");
		}

		// If subdomain is changing, check if new subdomain is available
		if (event.subdomain !== args.subdomain) {
			const existing = await ctx.db
				.query("events")
				.withIndex("by_subdomain", (q) => q.eq("subdomain", args.subdomain))
				.first();

			if (existing) {
				throw new Error("An event with this subdomain already exists");
			}
		}

		await ctx.db.patch(args.id, {
			subdomain: args.subdomain,
			title: args.title,
			description: args.description,
		});

		return null;
	},
});

export const deleteEvent = mutation({
	args: {
		id: v.id("events"),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		await ctx.db.delete(args.id);
		return null;
	},
});
