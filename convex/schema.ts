// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Define tables for your application
// Multi-Agent AI Platform

export default defineSchema({
  // Projects - now support multiple agent types
  projects: defineTable({
    name: v.string(),
    userId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    type: v.optional(v.string()), // "website", "code", "image", "chat", "mixed"
  }).index("by_user", ["userId"]).index("by_type", ["type"]),
  
  // Code generations - extended with agent info
  generations: defineTable({
    projectId: v.id("projects"),
    prompt: v.string(),
    code: v.string(),
    model: v.string(),
    createdAt: v.number(),
    agentType: v.optional(v.string()),
    language: v.optional(v.string()),
  }).index("by_project", ["projectId"]).index("by_agent", ["agentType"]),
  
  // NEW: Chat conversations
  conversations: defineTable({
    projectId: v.id("projects"),
    title: v.string(),
    agentType: v.string(), // "code", "image", "chat", "general"
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_project", ["projectId"]).index("by_agent", ["agentType"]),
  
  // NEW: Chat messages
  messages: defineTable({
    conversationId: v.id("conversations"),
    role: v.string(), // "user", "assistant", "system"
    content: v.string(),
    metadata: v.optional(v.any()), // images, code blocks, files, etc.
    createdAt: v.number(),
  }).index("by_conversation", ["conversationId"]),
  
  // NEW: Generated images
  images: defineTable({
    projectId: v.id("projects"),
    prompt: v.string(),
    imageUrl: v.string(),
    model: v.string(),
    style: v.optional(v.string()),
    width: v.number(),
    height: v.number(),
    createdAt: v.number(),
  }).index("by_project", ["projectId"]),
  
  // NEW: User preferences (extended)
  userPreferences: defineTable({
    userId: v.string(),
    theme: v.string(),
    defaultModel: v.string(),
    defaultAgent: v.string(),
    recentAgents: v.optional(v.array(v.string())),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),
  
  // NEW: Agent execution logs
  agentRuns: defineTable({
    projectId: v.id("projects"),
    agentType: v.string(),
    input: v.any(),
    output: v.optional(v.any()),
    status: v.string(), // "success", "error", "cancelled"
    error: v.optional(v.string()),
    duration: v.number(),
    model: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_project", ["projectId"]).index("by_agent", ["agentType"]),
});
