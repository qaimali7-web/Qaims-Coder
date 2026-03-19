# AI Website Builder

A simple, powerful AI-powered website builder that generates complete HTML websites from text descriptions.

## Features

- **Direct AI Integration**: Uses OpenRouter API for instant website generation
- **Single-File Output**: Generates complete, self-contained HTML with embedded CSS and JavaScript
- **Multiple Models**: Choose from StepFun, Claude, GPT-4o, Gemini, and Llama
- **Real-Time Streaming**: Watch your website build in real-time
- **Live Preview**: Built-in preview to see your website instantly
- **Clean Interface**: Focused, minimal UI designed for productivity

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure API Key

Copy `.env.example` to `.env.local` and add your OpenRouter API key:

```env
OPENROUTER_API_KEY=sk-or-v1-your-api-key-here
SITE_URL=https://your-site-url.com  # Optional
```

Get your API key from [OpenRouter](https://openrouter.ai/keys)

### 3. Run Development Server

```bash
npm run dev
```

Open http://localhost:3000 in your browser.

## Deploy to Vercel

1. Push your code to GitHub
2. Import repository in [Vercel](https://vercel.com)
3. Add environment variable `OPENROUTER_API_KEY` in Vercel dashboard
4. Deploy!

The app will be available at your Vercel URL.

## How It Works

1. Enter your OpenRouter API key (stored in browser localStorage)
2. Select your preferred AI model
3. Describe the website you want to build
4. Click "Generate Website"
5. Watch the code stream in real-time
6. Preview, edit, copy, or download your HTML file

## Technical Details

- **Frontend**: React 19 + TypeScript + Vite
- **UI**: Tailwind CSS + Monaco Editor
- **API**: OpenRouter (supports multiple AI models)
- **Build**: Static site generation for easy deployment
- **No Database**: Completely serverless - just API calls

## Project Structure

```
├── api/
│   └── generate-html.ts    # API endpoint for HTML generation
├── src/
│   ├── App.tsx             # Main application component
│   ├── main.tsx            # Entry point
│   └── index.css           # Global styles
├── index.html
├── package.json
├── vite.config.ts
└── tsconfig.json
```

## API Endpoint

**POST** `/api/generate-html`

Body:
```json
{
  "prompt": "Describe your website",
  "model": "stepfun/step-3.5-flash:free"
}
```

Returns: Server-Sent Events stream with chunks of generated HTML.

## License

MIT
