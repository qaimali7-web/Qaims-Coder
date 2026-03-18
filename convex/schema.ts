// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Define tables for your application
// For Qaim's Coder, we might want to store:
// 1. User projects
// 2. Code generations
// 3. User preferences

export default defineSchema({
  projects: defineTable({
    name: v.string(),
    userId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),
  
  generations: defineTable({
    projectId: v.id("projects"),
    prompt: v.string(),
    code: v.string(),
    model: v.string(),
    createdAt: v.number(),
  }).index("by_project", ["projectId"]),
  
  userPreferences: defineTable({
    userId: v.string(),
    theme: v.string(),
    defaultModel: v.string(),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),
});