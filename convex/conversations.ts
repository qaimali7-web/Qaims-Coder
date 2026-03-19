// convex/conversations.ts
import { mutation, query } from "./_generated/server";
import { v } from "./_generated/values";

// Create a new conversation
export const createConversation = mutation({
  args: {
    projectId: v.id("projects"),
    title: v.string(),
    agentType: v.string(),
  },
  handler: async (ctx, args) => {
    const conversation = {
      projectId: args.projectId,
      title: args.title,
      agentType: args.agentType,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const id = await ctx.db.insert("conversations", conversation);
    return id;
  },
});

// Get conversations for a project
export const getConversationsByProject = query({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.query("conversations")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
  },
});

// Add a message to a conversation
export const addMessage = mutation({
  args: {
    conversationId: v.id("conversations"),
    role: v.string(), // "user", "assistant", "system"
    content: v.string(),
    metadata: v.optional(v.string()), // JSON string for images, code blocks, files, etc.
  },
  handler: async (ctx, args) => {
    const message = {
      conversationId: args.conversationId,
      role: args.role,
      content: args.content,
      metadata: args.metadata,
      createdAt: Date.now(),
    };

    const id = await ctx.db.insert("messages", message);

    // Update conversation's updatedAt timestamp
    await ctx.db.patch(args.conversationId, {
      updatedAt: Date.now(),
    });

    return id;
  },
});

// Get messages for a conversation (with pagination)
export const getMessagesByConversation = query({
  args: {
    conversationId: v.id("conversations"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const queryBuilder = await ctx.db.query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .sort((a, b) => a.createdAt - b.createdAt);

    if (args.limit) {
      queryBuilder.limit(args.limit);
    }

    return queryBuilder.collect();
  },
});

// Delete a conversation (cascade delete messages)
export const deleteConversation = mutation({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args) => {
    // Delete all messages in this conversation
    const messages = await ctx.db.query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .collect();

    for (const message of messages) {
      await ctx.db.delete(message._id);
    }

    // Delete the conversation
    await ctx.db.delete(args.conversationId);
  },
});
