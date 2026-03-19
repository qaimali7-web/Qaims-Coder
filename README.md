# AI Website Builder

A simple, powerful AI-powered website builder that generates complete HTML websites from text descriptions.

## Features

- **Direct AI Integration**: Uses OpenRouter API with StepFun model
- **Single-File Output**: Generates complete, self-contained HTML files with embedded CSS and JavaScript
- **Real-Time Streaming**: Watch your website build in real-time
- **Live Preview**: Built-in preview to see your website instantly
- **Clean Interface**: Focused, minimal UI designed for productivity
- **One-Click Actions**: Copy, Download, and Preview buttons directly in the editor

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure API Key

Create a `.env.local` file in the project root:

```env
OPENROUTER_API_KEY=sk-or-v1-your-api-key-here
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
3. Add environment variable `OPENROUTER_API_KEY` in Vercel dashboard (Settings → Environment Variables)
4. Deploy!

The app will automatically build and deploy.

## How It Works

1. Enter your OpenRouter API key in `.env.local` (or Vercel environment variables)
2. Describe the website you want to build in the prompt area
3. Click "Generate Website"
4. Watch the code stream in real-time in the Monaco editor
5. Use the action buttons to:
   - **Copy** - Copy code to clipboard
   - **Download** - Download as index.html
   - **Preview** - Open live preview in a modal
6. Edit the code directly in the editor if needed

## Technical Details

- **Frontend**: React 19 + TypeScript + Vite
- **UI**: Tailwind CSS + Monaco Editor
- **API**: OpenRouter (StepFun AI model)
- **Build**: Static site generation for easy deployment
- **No Database**: Completely serverless - just API calls

## Project Structure

```
├── api/
│   └── generate-html.ts    # API endpoint for HTML generation
├── src/
│   ├── App.tsx             # Main application component
│   ├── main.tsx            # Entry point
│   ├── ErrorBoundary.tsx   # Error handling
│   └── index.css           # Global styles
├── build.cjs               # Custom build script for Vercel
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
└── README.md
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

## Environment Variables

- `OPENROUTER_API_KEY` (required) - Your OpenRouter API key
- `SITE_URL` (optional) - Your site URL for OpenRouter rankings

## Notes

- The app uses StepFun AI model by default (hardcoded)
- API key is configured via environment variable, not in the UI
- All action buttons (Copy, Download, Preview) appear in the editor header when code is generated
- Monaco Editor provides syntax highlighting and a professional editing experience

## License

MIT
