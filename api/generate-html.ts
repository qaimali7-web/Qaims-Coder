// api/generate-html.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { prompt, model } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    // 2. Check for API Key
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      console.error('Error: OPENROUTER_API_KEY is not defined in environment variables.');
      return res.status(500).json({ error: 'Server configuration error: API Key missing.' });
    }

    // 3. Prepare the request to OpenRouter
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.SITE_URL || 'http://localhost:3000',
        'X-Title': 'Qaim\'s Coder',
      },
      body: JSON.stringify({
        model: model || 'nvidia/nemotron-3-super-120b-a12b:free', // Fallback model
        messages: [
          {
            role: 'system',
            content: 'You are an expert web developer. Generate a single, self-contained HTML file based on the user request. Include CSS in <style> tags and JS in <script> tags. Do not use markdown code blocks. Output ONLY the HTML code.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        stream: true // Enable streaming
      }),
    });

    // 4. Handle OpenRouter Errors
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`OpenRouter API Error: ${response.status} - ${errorText}`);
      return res.status(response.status).json({ error: `AI Provider Error: ${response.status}` });
    }

    // 5. Set headers for Streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');

    // 6. Pipe the stream
    // We use a reader to read the stream from OpenRouter and write it to the Vercel response
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Failed to get response stream reader');
    }

    const decoder = new TextDecoder();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value, { stream: true });
      res.write(chunk);
    }

    res.end();

  } catch (error: any) {
    console.error('Server Error:', error);
    // If headers haven't been sent yet, send a JSON error
    if (!res.headersSent) {
      res.status(500).json({ error: error.message || 'Internal Server Error' });
    } else {
      // If streaming already started, we can't send a JSON status, 
      // but we can try to write a comment or just end.
      res.end();
    }
  }
}
