#!/usr/bin/env node

// Build script for AI Website Builder
// Handles dev server, build, and preview with API routes

import { createServer } from 'http';
import { readFile, mkdir, copyFile, unlink } from 'fs/promises';
import { join, dirname, extname, basename } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const PORT = process.env.PORT || 3001;
const VITE_DEV_PORT = 3000;

// Simple file server for static files in production mode
async function serveFile(filePath, res) {
  try {
    const content = await readFile(filePath);
    const ext = extname(filePath);
    const mimeTypes = {
      '.html': 'text/html',
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon',
    };
    const mime = mimeTypes[ext] || 'text/plain';
    res.writeHead(200, { 'Content-Type': mime });
    res.end(content);
  } catch (err) {
    res.writeHead(404);
    res.end('Not found');
  }
}

// API handler for /api/generate-html
async function handleGenerateHtml(req, res) {
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  // Simple rate limiting per IP
  const ip = req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxRequests = 10; // 10 requests per minute

  if (!global.rateLimitMap) {
    global.rateLimitMap = new Map();
  }

  const bucket = global.rateLimitMap.get(ip);
  if (!bucket || now - bucket.windowStart > windowMs) {
    global.rateLimitMap.set(ip, { count: 1, windowStart: now });
  } else {
    if (bucket.count >= maxRequests) {
      res.writeHead(429, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Rate limit exceeded' }));
      return;
    }
    bucket.count++;
  }

  // Read environment variable for API key
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'OPENROUTER_API_KEY not configured' }));
    return;
  }

  let body = '';
  req.on('data', chunk => {
    body += chunk.toString();
  });

  req.on('end', async () => {
    try {
      const { prompt, model = 'stepfun/step-3.5-flash:free' } = JSON.parse(body);

      if (!prompt) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Prompt is required' }));
        return;
      }

      // Set headers for SSE
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      });

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': process.env.SITE_URL || 'http://localhost:3000',
          'X-Title': 'AI Website Builder',
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'system',
              content: `You are an expert, senior web developer specialising in modern, visually stunning websites.

Your task is to produce a SINGLE, complete, self-contained HTML file with all CSS and JavaScript embedded inline.

━━━ STRICT OUTPUT RULES ━━━
1. Output RAW HTML only. No markdown fences, no explanations, no preamble.
2. The very first character of your response must be "<" (the opening of <!DOCTYPE html>).
3. The very last characters must be "</html>".
4. Never truncate or leave the file incomplete.

Start with <!DOCTYPE html> and end with </html>.`
            },
            {
              role: 'user',
              content: `Generate a complete, self-contained HTML file based on this description:\n\n${prompt}\n\nRemember: Output ONLY the raw HTML code with no markdown formatting, no explanations, and no surrounding text.`,
            },
          ],
          stream: true,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        res.write(`data: ${JSON.stringify({ error: `OpenRouter error: ${response.status} - ${errorText}` })}\n\n`);
        res.end();
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') {
              res.write('data: [DONE]\n\n');
              res.end();
              return;
            }

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                res.write(`data: ${JSON.stringify({ code: content, message: 'Generating...' })}\n\n`);
              }
            } catch (e) {
              // Skip invalid JSON lines
            }
          }
        }
      }

      res.end();
    } catch (error) {
      console.error('Generation error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
  });
}

// Development server (for both dev and preview modes)
function startServer(options = {}) {
  const { onReady, mode = 'dev' } = options;
  
  const server = createServer(async (req, res) => {
    console.log(`[${mode}] ${req.method} ${req.url}`);

    // Handle API routes
    if (req.url.startsWith('/api/')) {
      if (req.url === '/api/generate-html' || req.url.startsWith('/api/generate-html?')) {
        await handleGenerateHtml(req, res);
        return;
      }

      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
      return;
    }

    // Serve static files from dist
    let filePath = join(__dirname, 'dist', req.url === '/' ? 'index.html' : req.url);
    await serveFile(filePath, res);
  });

  return new Promise((resolve) => {
    server.listen(PORT, () => {
      console.log(`\n🚀 Server ready on http://localhost:${PORT}`);
      if (onReady) onReady(server);
      resolve(server);
    });
  });
}

// Build function
async function build() {
  console.log('🏗️  Building for production...');
  
  // Run Vite build
  const vite = spawn('npx', ['vite', 'build'], { 
    stdio: 'inherit',
    cwd: __dirname 
  });

  await new Promise((resolve, reject) => {
    vite.on('close', (code) => {
      if (code === 0) {
        console.log('✅ Vite build completed');
        resolve();
      } else {
        reject(new Error(`Vite build failed with code ${code}`));
      }
    });
  });

  // Copy api/generate-html.ts to dist/api/ for serverless deployment
  const apiSrc = join(__dirname, 'api', 'generate-html.ts');
  const apiDst = join(__dirname, 'dist', 'api', 'generate-html.ts');
  
  try {
    await mkdir(join(__dirname, 'dist', 'api'), { recursive: true });
    await copyFile(apiSrc, apiDst);
    console.log('✅ API file copied to dist/');
  } catch (err) {
    console.error('Failed to copy API file:', err);
  }

  console.log('✅ Build completed successfully');
}

// Main entry point
const command = process.argv[2];

switch (command) {
  case 'build':
    build().catch((err) => {
      console.error('Build failed:', err);
      process.exit(1);
    });
    break;

  case 'preview':
    startServer({ mode: 'preview' });
    break;

  case 'dev':
  default:
    startServer({ mode: 'dev' });
    break;
}
