<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Qaim's Coder - AI-Powered HTML Generator

This contains everything you need to run your AI-powered HTML code generator locally.

**Now powered by OpenRouter** - Access to multiple AI models including Claude, GPT-4, Gemini, and more!

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set up your API key:
   - Copy `.env.example` to `.env.local`
   - Get your OpenRouter API key from [OpenRouter](https://openrouter.ai/keys)
   - Add your API key to `.env.local`:
     ```
     OPENROUTER_API_KEY=sk-or-v1-your_actual_api_key_here
     SITE_URL=https://your-site-url.com  # Optional
     ```
3. Run the app:
   `npm run dev`

## Deploy to Vercel

1. Push your code to GitHub
2. Connect your repository to [Vercel](https://vercel.com)
3. In your Vercel dashboard, go to **Settings > Environment Variables**
4. Add: `OPENROUTER_API_KEY` = `sk-or-v1-your_actual_api_key_here`
5. Optionally add: `SITE_URL` = `https://your-vercel-app-url.vercel.app`
6. Deploy!

The app will automatically build and deploy using the configuration in `vercel.json`.

## Deploy to Netlify

1. Push your code to GitHub
2. Connect your repository to [Netlify](https://netlify.com)
3. In your Netlify dashboard, go to Site Settings > Environment Variables
4. Add your `GEMINI_API_KEY` environment variable
5. Deploy!

The app will automatically build and deploy using the configuration in `netlify.toml`.
