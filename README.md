# Qaim's Coder — AI Website Builder

A production-grade, AI-powered website builder that generates complete, self-contained HTML websites from text descriptions in real time.

---

## Features

| Feature | Details |
|---|---|
| **Multi-model AI** | NVIDIA Nemotron 3 Super (free), GPT-4o Mini, Claude 3 Haiku |
| **Real-time streaming** | Watch code appear token by token |
| **Auto-retry** | Automatically continues if generation stalls or truncates |
| **Monaco Editor** | Full VS Code editor with syntax highlighting & IntelliSense |
| **Live preview** | Sandboxed iframe preview + open in new tab |
| **Generation history** | Persisted in localStorage — restore any previous session |
| **Toast notifications** | Replaces all `alert()` calls with non-blocking toasts |
| **Rate limiting** | 10 requests/minute per IP on the API route |
| **Mobile responsive** | Collapsible sidebar, works on any screen size |
| **Keyboard shortcut** | `⌘ Enter` / `Ctrl Enter` to generate |

---

## Quick Start

### 1. Clone & Install

```bash
git clone <your-repo>
cd ai-website-builder
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
OPENROUTER_API_KEY=sk-or-v1-your-real-key-here
SITE_URL=http://localhost:3000
```

Get a free API key at [openrouter.ai/keys](https://openrouter.ai/keys)

### 3. Run

```bash
npm run dev        # starts Vite on http://localhost:3000
```

> **Note**: In development the `/api` route is proxied to `localhost:3001`. For full API testing locally, deploy to Vercel or use the Vercel CLI (`npx vercel dev`).

---

## Deploy to Vercel

```bash
npm i -g vercel
vercel deploy
```

Then add your environment variable in the Vercel dashboard:

**Settings → Environment Variables**

| Key | Value |
|---|---|
| `OPENROUTER_API_KEY` | `sk-or-v1-...` |
| `SITE_URL` | `https://your-app.vercel.app` |

---

## Project Structure

```
├── api/
│   └── generate-html.ts   # Vercel serverless function (typed, rate-limited)
├── src/
│   ├── components/
│   │   ├── EditorSkeleton.tsx  # Loading shimmer for Monaco
│   │   ├── HistoryPanel.tsx    # Browsable generation history
│   │   ├── ModelSelector.tsx   # AI model dropdown
│   │   ├── PreviewModal.tsx    # Sandboxed iframe preview
│   │   ├── StatusBar.tsx       # Bottom status bar
│   │   └── Toast.tsx           # Non-blocking notification system
│   ├── hooks/
│   │   ├── useGeneration.ts    # Stream generation logic (stale-closure-free)
│   │   └── useHistory.ts       # localStorage persistence hook
│   ├── App.tsx                 # Main application
│   ├── ErrorBoundary.tsx       # Top-level error boundary
│   ├── main.tsx                # Entry point
│   ├── types.ts                # Shared TypeScript types
│   └── index.css               # Tailwind + custom animations
├── .env.example               # Safe template — copy to .env.local
├── .gitignore                 # Blocks .env.local from being committed
├── index.html
├── package.json
├── tsconfig.json
├── vercel.json
└── vite.config.ts
```

---

## Security Notes

- `.env.local` is blocked by `.gitignore` — never committed
- API key lives only in server-side environment variables
- Preview iframe uses `sandbox="allow-scripts allow-forms allow-popups"` — **no** `allow-same-origin`, preventing the iframe from accessing parent window cookies/storage
- Model input is validated against an allowlist on the server
- Prompt length is capped at 4000 characters server-side
- Rate limiting: 10 requests per minute per IP

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `OPENROUTER_API_KEY` | ✅ Yes | Your OpenRouter API key |
| `SITE_URL` | Optional | Shown in OpenRouter referrer stats |

---

## Scripts

```bash
npm run dev      # Development server (Vite)
npm run build    # Production build
npm run preview  # Preview production build locally
npm run lint     # TypeScript type check
```

---

## License

MIT
