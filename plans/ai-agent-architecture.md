# AI Agent Platform Architecture

## Current State Analysis

### Existing Features
- **Website Builder**: HTML code generation with Monaco editor
- **Chat Interface**: Conversational UI for code generation
- **Project Management**: Create, load, delete projects (Convex DB)
- **Version History**: LocalStorage-based version tracking
- **Multi-Model Support**: StepFun, Claude, GPT-4, Gemini, Llama via OpenRouter
- **Code Generation API**: `/api/generate` endpoint

### Current Tech Stack
- **Frontend**: React + TypeScript + Vite
- **UI**: Tailwind CSS + Lucide icons + Monaco Editor
- **Backend**: Convex (DB + server functions) + Vercel/Netlify (API routes)
- **AI**: OpenRouter API (multiple models)
- **Storage**: LocalStorage (versions) + Convex DB (projects, generations)

---

## Proposed Multi-Agent Architecture

### 1. Agent Types

#### A. Website Builder Agent (Existing - Enhanced)
- **Purpose**: Build complete websites from descriptions
- **Output**: HTML/CSS/JavaScript (single-file or multi-file)
- **Features**:
  - Component library suggestions
  - Responsive design patterns
  - SEO optimization
  - Accessibility checks
  - Preview in embedded browser

#### B. Code Assistant Agent (New)
- **Purpose**: Write, debug, and explain code in multiple languages
- **Supported Languages**: Python, JavaScript/TypeScript, Java, C++, Go, Rust, Ruby, PHP, Swift, Kotlin
- **Features**:
  - Language-specific syntax highlighting
  - Code execution sandbox (for interpreted languages)
  - Debugging assistance
  - Code review & optimization
  - Unit test generation
  - Documentation generation

#### C. Image Generation Agent (New)
- **Purpose**: Create images from text descriptions
- **Models**: DALL-E 3, Stable Diffusion, Midjourney (via OpenRouter or direct APIs)
- **Features**:
  - Multiple style presets (realistic, cartoon, pixel art, etc.)
  - Image editing (inpainting/outpainting)
  - Image-to-image transformation
  - Gallery management
  - Export in multiple formats (PNG, JPEG, WebP, SVG)

#### D. General Chat Agent (New)
- **Purpose**: Conversational AI for general questions, brainstorming, planning
- **Features**:
  - Context-aware conversations
  - Memory of past interactions
  - File upload support (PDF, images, documents)
  - Web search integration (optional)
  - Export conversations

#### E. (Future) Additional Agents
- **Data Analysis Agent**: CSV/JSON analysis, charts, statistics
- **Document Writer Agent**: Reports, articles, documentation
- **Translation Agent**: Multi-language translation
- **Audio Agent**: Text-to-speech, speech-to-text

---

### 2. Database Schema Extension

```typescript
// convex/schema.ts - Extended

export default defineSchema({
  // Existing tables
  projects: defineTable({
    name: v.string(),
    userId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    // NEW: project type to distinguish agent contexts
    type: v.optional(v.string()), // "website", "code", "image", "chat", "mixed"
  }).index("by_user", ["userId"]).index("by_type", ["type"]),

  generations: defineTable({
    projectId: v.id("projects"),
    prompt: v.string(),
    code: v.string(),
    model: v.string(),
    createdAt: v.number(),
    // NEW: agent type that generated this
    agentType: v.optional(v.string()),
    // NEW: language for code agents
    language: v.optional(v.string()),
  }).index("by_project", ["projectId"]).index("by_agent", ["agentType"]),

  // NEW: Chat conversations table
  conversations: defineTable({
    projectId: v.id("projects"),
    title: v.string(),
    agentType: v.string(), // Which agent handled this conversation
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_project", ["projectId"]).index("by_agent", ["agentType"]),

  // NEW: Chat messages table
  messages: defineTable({
    conversationId: v.id("conversations"),
    role: v.string(), // "user", "assistant", "system"
    content: v.string(),
    metadata: v.optional(v.any()), // images, code blocks, files, etc.
    createdAt: v.number(),
  }).index("by_conversation", ["conversationId"]),

  // NEW: Generated images table
  images: defineTable({
    projectId: v.id("projects"),
    prompt: v.string(),
    imageUrl: v.string(), // URL to stored image (Convex blob storage or external)
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
    defaultAgent: v.string(), // Which agent opens by default
    recentAgents: v.optional(v.array(v.string())),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),

  // NEW: Agent execution logs (for debugging/analytics)
  agentRuns: defineTable({
    projectId: v.id("projects"),
    agentType: v.string(),
    input: v.any(),
    output: v.optional(v.any()),
    status: v.string(), // "success", "error", "cancelled"
    error: v.optional(v.string()),
    duration: v.number(), // ms
    model: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_project", ["projectId"]).index("by_agent", ["agentType"]),
});
```

---

### 3. API Endpoints Structure

```
/api/
├── generate.ts           # Existing - website builder
├── chat/
│   ├── index.ts         # General chat endpoint
│   ├── code.ts          # Code assistant endpoint
│   └── image.ts         # Image generation endpoint
├── agents/
│   ├── list.ts          # Get available agents
│   ├── execute.ts       # Execute specific agent
│   └── capabilities.ts  # Get agent capabilities
└── projects/
    ├── create.ts        # Already in Convex
    ├── list.ts          # Already in Convex
    └── delete.ts        # Already in Convex
```

---

### 4. Frontend Architecture

#### Component Structure

```
src/
├── components/
│   ├── agents/
│   │   ├── AgentSelector.tsx      # Tab/button to switch agents
│   │   ├── WebsiteBuilder.tsx     # Current main editor
│   │   ├── CodeAssistant.tsx      # Multi-language code editor
│   │   ├── ImageGenerator.tsx     # Image generation UI
│   │   ├── ChatInterface.tsx      # General chat UI
│   │   └── AgentPanel.tsx         # Unified panel wrapper
│   ├── common/
│   │   ├── ProjectSidebar.tsx     # Project list (enhanced)
│   │   ├── MessageBubble.tsx      # Chat message component
│   │   ├── CodeBlock.tsx          # Syntax highlighted code
│   │   ├── ImageGallery.tsx       # Generated images grid
│   │   └── FileUpload.tsx         # Upload files for analysis
│   └── layout/
│       ├── Header.tsx
│       ├── Sidebar.tsx
│       └── MainPanel.tsx
├── hooks/
│   ├── useAgents.ts              # Agent management
│   ├── useChat.ts                # Chat state management
│   ├── useImageGeneration.ts     # Image generation logic
│   └── useConvex.ts (existing)
├── types/
│   ├── agent.ts                  # Agent type definitions
│   ├── chat.ts                   # Chat message types
│   └── project.ts                # Project types
└── utils/
    ├── agentRouter.ts            # Route requests to correct agent
    ├── codeExecutors.ts          # Sandbox code execution
    ├── imageProcessors.ts        # Image processing utilities
    └── promptBuilders.ts         # Build agent-specific prompts
```

---

### 5. Agent Selection UI Design

**Option A: Tabbed Interface**
```
[Website Builder] [Code Assistant] [Image Gen] [Chat] [All-in-One]
```

**Option B: Sidebar with Agent Cards**
```
Agents
├── 🌐 Website Builder
├── 💻 Code Assistant
├── 🎨 Image Generator
├── 💬 General Chat
└── 🔀 Multi-Agent
```

**Option C: Command Palette**
- `Ctrl/Cmd + K` opens agent selector
- Type to search agent
- Enter to switch

**Recommended**: Hybrid approach - tabs for quick switching + command palette for power users.

---

### 6. Implementation Phases

#### Phase 1: Foundation (Week 1-2)
- [ ] Extend database schema with new tables
- [ ] Create agent management system (CRUD for agents)
- [ ] Build AgentSelector component
- [ ] Implement agent routing middleware
- [ ] Add agent type field to projects
- [ ] Update useConvex hook with agent functions

#### Phase 2: Code Assistant (Week 3-4)
- [ ] Create CodeAssistant component
- [ ] Multi-language syntax highlighting
- [ ] Code execution sandbox (WebContainers or Pyodide)
- [ ] `/api/chat/code` endpoint
- [ ] Language-specific prompts
- [ ] Code formatting & linting
- [ ] Unit test generation

#### Phase 3: Image Generation (Week 5-6)
- [ ] Create ImageGenerator component
- [ ] Image gallery display
- [ ] `/api/chat/image` endpoint
- [ ] Integrate image API (OpenRouter/DALL-E)
- [ ] Style presets
- [ ] Image download/export
- [ ] Basic image editing (crop, filter)

#### Phase 4: General Chat (Week 7-8)
- [ ] Create ChatInterface component
- [ ] Message threading
- [ ] `/api/chat` endpoint
- [ ] File upload support
- [ ] Conversation export (JSON, PDF, TXT)
- [ ] Search through conversations
- [ ] Memory/context management

#### Phase 5: Integration & Polish (Week 9-10)
- [ ] Multi-agent workflows (chain agents)
- [ ] Agent suggestions based on project type
- [ ] Performance optimizations
- [ ] Error handling & user feedback
- [ ] Accessibility improvements
- [ ] Mobile responsive design
- [ ] Documentation & tutorials

---

### 7. Technical Considerations

#### Agent Routing
```typescript
// utils/agentRouter.ts
export const AGENT_ENDPOINTS = {
  website: '/api/generate',
  code: '/api/chat/code',
  image: '/api/chat/image',
  chat: '/api/chat',
};

export const AGENT_CONFIGS = {
  website: {
    name: 'Website Builder',
    icon: '🌐',
    defaultModel: 'stepfun/step-3.5-flash:free',
    systemPrompt: 'You are an expert web coder...',
  },
  code: {
    name: 'Code Assistant',
    icon: '💻',
    defaultModel: 'anthropic/claude-3.5-sonnet',
    systemPrompt: 'You are an expert programmer...',
    supportedLanguages: ['python', 'javascript', 'typescript', ...],
  },
  // ...
};
```

#### Unified Chat Interface
- All agents use same message format
- Agent-specific metadata in `message.metadata`
- Streaming responses for all agents
- Real-time updates via Convex subscriptions

#### Image Storage Strategy
- Option 1: Convex blob storage (if available)
- Option 2: Cloud storage (S3, Cloudflare R2)
- Option 3: External service (Imgur, Cloudinary)
- Store thumbnails for gallery view

#### Code Execution Sandbox
- **Web Languages**: iframe sandbox (already have preview)
- **Python**: Pyodide (WebAssembly)
- **Node.js**: WebContainers (StackBlitz)
- **Compiled Languages**: WASM-based compilers or server-side execution

---

### 8. User Experience Flow

#### New User Onboarding
1. Welcome screen with agent selection
2. Quick tutorial for each agent type
3. Sample projects for each agent
4. Progressive disclosure of features

#### Switching Agents
- Current project context preserved
- Agent-specific UI loads
- Previous conversations/code/images remain accessible
- Option to convert content between agents

#### Multi-Agent Workflows
- Example: "Create a website, then generate a logo for it"
- Chain agents automatically
- Pass data between agents (code → image → documentation)

---

### 9. Environment Variables

```bash
# Existing
OPENROUTER_API_KEY=
SITE_URL=
VITE_CONVEX_URL=

# New (Image Generation)
# Optional if using OpenRouter for images
OPENROUTER_API_KEY= (same key works)

# Or specific image APIs
DALLE_API_KEY= (optional)
STABILITY_API_KEY= (optional)

# For code execution sandbox (if server-side)
SANDBOX_API_URL= (optional)
```

---

### 10. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| API rate limits (OpenRouter) | High | Implement caching, rate limiting, fallback models |
| Image storage costs | Medium | Use CDN, compress images, set storage limits |
| Code execution security | High | Strict sandboxing, resource limits, timeouts |
| Complexity overwhelm | Medium | Progressive disclosure, good defaults, tutorials |
| Performance with large projects | Medium | Pagination, lazy loading, virtualization |

---

### 11. Success Metrics

- **Adoption**: % of users using multiple agent types
- **Engagement**: Average sessions per user, time spent
- **Retention**: Weekly/monthly active users
- **Satisfaction**: User feedback, NPS score
- **Performance**: API response times, error rates

---

## Next Steps

1. Review this architecture with the user
2. Prioritize which agents to build first (recommend: Code Assistant → Image Gen → Chat)
3. Set up project tracking (GitHub Projects, Linear, etc.)
4. Begin Phase 1 implementation
5. Regular user testing & feedback

---

## Questions for User

1. Which agent types are highest priority? (All requested, but need order)
2. Should image generation use same OpenRouter API or separate APIs?
3. What's the target audience? (Developers, designers, general users?)
4. Should we support team collaboration features?
5. What's the monetization strategy? (Free tier, paid agents, usage limits?)
6. Do you need advanced features like:
   - Voice input/output?
   - Real-time collaboration?
   - Plugin system for custom agents?
   - Export to various formats (PDF, DOCX, etc.)?
