// convex/agents.ts
import { mutation, query } from "./_generated/server";
import { v } from "./_generated/values";

// Agent types enum
export const AGENT_TYPES = {
  WEBSITE: "website",
  CODE: "code",
  IMAGE: "image",
  CHAT: "chat",
} as const;

// Agent configuration interface
interface AgentConfig {
  name: string;
  description: string;
  icon: string;
  defaultModel: string;
  systemPrompt: string;
  supportedLanguages?: string[];
  supportedStyles?: string[];
}

// Predefined agent configurations
export const AGENT_CONFIGS: Record<string, AgentConfig> = {
  website: {
    name: "Website Builder",
    description: "Build complete websites from descriptions",
    icon: "🌐",
    defaultModel: "stepfun/step-3.5-flash:free",
    systemPrompt: "You are an expert web coder. Return ONLY the raw HTML code for a single-file website. No markdown. No explanations. Ensure Blogger compatibility (self-closing meta/link tags, CDATA for scripts/styles).",
  },
  code: {
    name: "Code Assistant",
    description: "Write, debug, and explain code in multiple languages",
    icon: "💻",
    defaultModel: "anthropic/claude-3.5-sonnet",
    systemPrompt: "You are an expert programmer. Help users write, debug, and optimize code. Provide clear explanations and best practices. Support multiple programming languages including Python, JavaScript, TypeScript, Java, C++, Go, and more.",
    supportedLanguages: [
      "python", "javascript", "typescript", "java", "cpp", "go", "rust",
      "ruby", "php", "swift", "kotlin", "csharp", "html", "css", "sql"
    ],
  },
  image: {
    name: "Image Generator",
    description: "Create images from text descriptions",
    icon: "🎨",
    defaultModel: "stability-ai/sdxl-turbo",
    systemPrompt: "You are an image generation assistant. Create high-quality images based on user descriptions. Support various styles and formats.",
    supportedStyles: ["realistic", "cartoon", "pixel-art", "watercolor", "sketch", "3d-render"],
  },
  chat: {
    name: "General Chat",
    description: "Conversational AI for general questions and brainstorming",
    icon: "💬",
    defaultModel: "openai/gpt-4o-mini",
    systemPrompt: "You are a helpful AI assistant. Engage in natural conversations, answer questions, help with brainstorming, planning, and general tasks. Be friendly, informative, and concise.",
  },
};

// Query to get all available agents
export const getAvailableAgents = query({
  args: {},
  handler: async () => {
    return Object.entries(AGENT_CONFIGS).map(([key, config]) => ({
      id: key,
      ...config,
    }));
  },
});

// Query to get agent by ID
export const getAgentById = query({
  args: {
    agentId: v.string(),
  },
  handler: async (ctx, args) => {
    const config = AGENT_CONFIGS[args.agentId];
    if (!config) {
      throw new Error(`Agent not found: ${args.agentId}`);
    }
    return {
      id: args.agentId,
      ...config,
    };
  },
});

// Mutation to create a new project with agent type
export const createProjectWithAgent = mutation({
  args: {
    name: v.string(),
    agentType: v.string(),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const project = {
      name: args.name,
      userId: args.userId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      type: args.agentType,
    };

    const id = await ctx.db.insert("projects", project);
    return id;
  },
});

// Query to get projects by agent type
export const getProjectsByAgent = query({
  args: {
    agentType: v.string(),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const filter: any = { type: args.agentType };
    if (args.userId) {
      filter.userId = args.userId;
    }

    return await ctx.db.query("projects")
      .withIndex("by_type", (q) => q.eq("type", args.agentType))
      .collect();
  },
});

// Mutation to update project type
export const updateProjectType = mutation({
  args: {
    projectId: v.id("projects"),
    agentType: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.projectId, {
      type: args.agentType,
      updatedAt: Date.now(),
    });
  },
});
