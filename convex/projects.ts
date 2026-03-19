// convex/projects.ts
import { mutation, query } from "./_generated/server";
import { v } from "./_generated/values";

// Mutation to create a new project
export const createProject = mutation({
  args: {
    name: v.string(),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const project = {
      name: args.name,
      userId: args.userId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    
    const id = await ctx.db.insert("projects", project);
    return id;
  },
});

// Query to get all projects for a user
export const getProjectsByUser = query({
  args: {
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!args.userId) {
      return [];
    }
    
    return await ctx.db.query("projects")
      .withIndex("by_user", q => q.eq("userId", args.userId))
      .collect();
  },
});

// Mutation to update project timestamp
export const updateProjectTimestamp = mutation({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.projectId, {
      updatedAt: Date.now(),
    });
  },
});