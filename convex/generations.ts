// convex/generations.ts
import { mutation, query } from "./_generated/server";
import { v } from "./_generated/values";

// ============ Project Architect Flow ============

// Helper to serialize objects to JSON strings for storage
const toJson = (obj: any) => JSON.stringify(obj);
const fromJson = (json: string) => JSON.parse(json);

// Mutation to create a project manifest (planning phase)
export const createProjectManifest = mutation({
  args: {
    projectId: v.string(),
    prompt: v.string(),
    model: v.string(),
  },
  handler: async (ctx, args) => {
    // This will be called from the API to generate a manifest
    // The actual AI call happens in the API route, we just store the result
    const manifest = {
      structure: 'single-page',
      files: [],
      description: '',
      totalFiles: 0,
    };
    
    const generation = {
      projectId: args.projectId,
      prompt: args.prompt,
      manifest: toJson(manifest),
      model: args.model,
      createdAt: Date.now(),
      status: 'planning',
      progress: toJson({
        currentFile: '',
        fileIndex: 0,
        totalFiles: 0,
        stage: 'planning',
        message: 'Creating project plan...',
        percentage: 0,
      }),
    };
    
    const id = await ctx.db.insert("generations", generation);
    return { id, manifest };
  },
});

// Mutation to store project files (multi-file support)
export const storeProjectFiles = mutation({
  args: {
    projectId: v.string(),
    files: v.string(), // JSON stringified array of ProjectFile objects
    generationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const files = fromJson(args.files);
    
    const fileRecords = files.map((file: any, index: number) => ({
      projectId: args.projectId,
      path: file.path,
      content: file.content,
      language: file.language,
      isMain: file.isMain || false,
      order: file.order ?? index,
      generationId: args.generationId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }));

    const ids = await Promise.all(
      fileRecords.map(record => ctx.db.insert("projectFiles", record))
    );

    return ids;
  },
});

// Mutation to update generation progress
export const updateGenerationProgress = mutation({
  args: {
    generationId: v.string(),
    progress: v.string(), // JSON stringified GenerationProgress object
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.generationId, {
      progress: args.progress,
      status: fromJson(args.progress).stage as any,
    });
    return true;
  },
});

// Mutation to complete generation
export const completeGeneration = mutation({
  args: {
    generationId: v.string(),
    manifest: v.optional(v.string()), // JSON stringified ProjectManifest
  },
  handler: async (ctx, args) => {
    const updates: any = {
      status: 'complete',
    };
    
    if (args.manifest) {
      updates.manifest = args.manifest;
    }
    
    await ctx.db.patch(args.generationId, updates);
    return true;
  },
});

// Mutation to fail generation
export const failGeneration = mutation({
  args: {
    generationId: v.string(),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.generationId, {
      status: 'error',
      error: args.error,
    });
    return true;
  },
});

// Query to get project files
export const getProjectFiles = query({
  args: {
    projectId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.query("projectFiles")
      .withIndex("by_project", q => q.eq("projectId", args.projectId))
      .collect();
  },
});

// Query to get files ordered
export const getProjectFilesOrdered = query({
  args: {
    projectId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.query("projectFiles")
      .withIndex("by_project_order", q => q.eq("projectId", args.projectId))
      .order(q => q.asc("order"))
      .collect();
  },
});

// Query to get latest generation for project
export const getLatestGeneration = query({
  args: {
    projectId: v.string(),
  },
  handler: async (ctx, args) => {
    const generations = await ctx.db.query("generations")
      .withIndex("by_project", q => q.eq("projectId", args.projectId))
      .order(q => q.desc("createdAt"))
      .limit(1)
      .collect();
    
    return generations[0] || null;
  },
});

// Legacy mutation for backward compatibility
export const storeGeneration = mutation({
  args: {
    projectId: v.string(),
    prompt: v.string(),
    code: v.string(),
    model: v.string(),
  },
  handler: async (ctx, args) => {
    // Create a single-file manifest for backward compatibility
    const manifest = {
      structure: 'single-page',
      files: [{
        path: 'index.html',
        content: args.code,
        language: 'html',
        isMain: true,
        order: 0,
      }],
      description: args.prompt,
      totalFiles: 1,
    };

    const generation = {
      projectId: args.projectId,
      prompt: args.prompt,
      manifest: toJson(manifest),
      model: args.model,
      createdAt: Date.now(),
      status: 'complete',
    };
    
    const id = await ctx.db.insert("generations", generation);
    
    // Also store the file
    await ctx.db.insert("projectFiles", {
      projectId: args.projectId,
      path: 'index.html',
      content: args.code,
      language: 'html',
      isMain: true,
      order: 0,
      generationId: id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    
    return id;
  },
});
