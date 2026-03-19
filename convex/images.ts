// convex/images.ts
import { mutation, query } from "./_generated/server";
import { v } from "./_generated/values";

// Create a new generated image record
export const createImage = mutation({
  args: {
    projectId: v.id("projects"),
    prompt: v.string(),
    imageUrl: v.string(),
    model: v.string(),
    style: v.optional(v.string()),
    width: v.number(),
    height: v.number(),
  },
  handler: async (ctx, args) => {
    const image = {
      projectId: args.projectId,
      prompt: args.prompt,
      imageUrl: args.imageUrl,
      model: args.model,
      style: args.style,
      width: args.width,
      height: args.height,
      createdAt: Date.now(),
    };

    const id = await ctx.db.insert("images", image);
    return id;
  },
});

// Get images for a project
export const getImagesByProject = query({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.query("images")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .sort((a, b) => b.createdAt - a.createdAt)
      .collect();
  },
});

// Delete an image
export const deleteImage = mutation({
  args: {
    imageId: v.id("images"),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.imageId);
  },
});
