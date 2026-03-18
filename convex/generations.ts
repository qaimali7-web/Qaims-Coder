// convex/generations.ts
import { mutation } from "./_generated/server";
import { v } from "convex/values";

// Mutation to store a new code generation
export const storeGeneration = mutation({
  args: {
    projectId: v.string(),
    prompt: v.string(),
    code: v.string(),
    model: v.string(),
  },
  handler: async (ctx, args) => {
    const generation = {
      projectId: args.projectId,
      prompt: args.prompt,
      code: args.code,
      model: args.model,
      createdAt: Date.now(),
    };
    
    const id = await ctx.db.insert("generations", generation);
    return id;
  },
});

// Query to get all generations for a project
export const getGenerationsByProject = mutation({
  args: {
    projectId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.query("generations")
      .withIndex("by_project", q => q.eq("projectId", args.projectId))
      .collect();
  },
});