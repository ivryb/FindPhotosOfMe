import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getAll = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("todos"),
      _creationTime: v.number(),
      text: v.string(),
      completed: v.boolean(),
    })
  ),
  handler: async (ctx) => {
    return await ctx.db.query("todos").collect();
  },
});

export const create = mutation({
  args: {
    text: v.string(),
  },
  returns: v.union(
    v.object({
      _id: v.id("todos"),
      _creationTime: v.number(),
      text: v.string(),
      completed: v.boolean(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const newTodoId = await ctx.db.insert("todos", {
      text: args.text,
      completed: false,
    });
    return await ctx.db.get(newTodoId);
  },
});

export const toggle = mutation({
  args: {
    id: v.id("todos"),
    completed: v.boolean(),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { completed: args.completed });
    return { success: true };
  },
});

export const deleteTodo = mutation({
  args: {
    id: v.id("todos"),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return { success: true };
  },
});
