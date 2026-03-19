// api/build-site.ts - Project Architect with Streaming (Vercel Serverless)
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).send("Method not allowed");
    return;
  }

  const { prompt, projectId, model = "stepfun/step-3.5-flash:free" } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  // Set up SSE response
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sendEvent = (data: any) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    // Step 1: Generate Project Manifest
    sendEvent({
      type: 'progress',
      progress: {
        currentFile: '',
        fileIndex: 0,
        totalFiles: 0,
        stage: 'planning',
        message: 'Analyzing project requirements...',
        percentage: 10,
      }
    });

    const manifest = await generateManifest(prompt, model);
    
    sendEvent({
      type: 'progress',
      progress: {
        currentFile: 'manifest',
        fileIndex: 0,
        totalFiles: manifest.totalFiles,
        stage: 'planning',
        message: `Project plan ready: ${manifest.description}`,
        percentage: 20,
      }
    });

    // Step 2: Generate each file
    const files = [];
    for (let i = 0; i < manifest.files.length; i++) {
      const fileSpec = manifest.files[i];
      
      sendEvent({
        type: 'progress',
        progress: {
          currentFile: fileSpec.path,
          fileIndex: i + 1,
          totalFiles: manifest.totalFiles,
          stage: 'generating',
          message: `Generating ${fileSpec.path}...`,
          percentage: 20 + Math.round((i / manifest.totalFiles) * 60),
        }
      });

      const content = await generateFileContent(
        prompt,
        fileSpec,
        files, // previously generated files
        model
      );

      files.push({
        ...fileSpec,
        content,
      });

      sendEvent({
        type: 'file_complete',
        filePath: fileSpec.path,
        content,
      });
    }

    // Step 3: Finalize
    sendEvent({
      type: 'progress',
      progress: {
        currentFile: '',
        fileIndex: manifest.totalFiles,
        totalFiles: manifest.totalFiles,
        stage: 'finalizing',
        message: 'Project generation complete',
        percentage: 100,
      }
    });

    sendEvent({
      type: 'complete',
      manifest,
      files,
    });

  } catch (error: any) {
    console.error('Build site error:', error);
    
    // Determine error type
    let errorType: string = 'unknown';
    if (error.message?.includes('context') || error.message?.includes('length')) {
      errorType = 'context_length';
    } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
      errorType = 'network';
    } else if (error.message?.includes('rate limit')) {
      errorType = 'rate_limit';
    }

    sendEvent({
      type: 'error',
      error: {
        type: errorType,
        message: error.message || 'Unknown error',
        details: error.details,
        statusCode: error.statusCode,
      },
    });
  } finally {
    res.end();
  }
}

// Helper to generate manifest using AI
async function generateManifest(prompt: string, model: string): Promise<any> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY not configured');
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.SITE_URL || 'https://your-app.vercel.app',
      'X-Title': 'Qaims Coder - Project Architect',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: MANIFEST_SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      stream: false,
      max_tokens: 2000,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Manifest generation failed: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content?.trim() || '{}';
  
  // Clean up any markdown formatting
  const jsonStr = content
    .replace(/^```json\n?/, '')
    .replace(/^```\n?/, '')
    .replace(/\n?```$/, '');
  
  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error('Failed to parse manifest:', jsonStr);
    throw new Error('AI returned invalid manifest format');
  }
}

// Helper to generate individual file content
async function generateFileContent(
  prompt: string,
  fileSpec: any,
  previousFiles: Array<{ path: string; content: string }>,
  model: string
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY not configured');
  }

  // Build context from previous files
  const context = previousFiles.length > 0
    ? `\n\nPreviously generated files:\n${previousFiles.map(f => `=== ${f.path} ===\n${f.content}`).join('\n\n')}`
    : '';

  const userPrompt = fileSpec.language === 'html'
    ? `Create the ${fileSpec.path} file for: ${prompt}\n\n${context}\n\nReturn ONLY the raw ${fileSpec.language} code. No markdown. No explanations.`
    : `Create the ${fileSpec.path} file (${fileSpec.language}) for: ${prompt}\n\n${context}\n\nReturn ONLY the raw ${fileSpec.language} code. No markdown. No explanations.`;

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.SITE_URL || 'https://your-app.vercel.app',
      'X-Title': 'Qaims Coder - File Generator',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      stream: false,
      max_tokens: 8000,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `File generation failed: ${response.status}`);
  }

  const data = await response.json();
  let content = data.choices?.[0]?.message?.content || '';

  // Clean up markdown if present
  content = content
    .replace(/^```\w+\n?/, '')
    .replace(/^```\n?/, '')
    .replace(/\n?```$/, '')
    .trim();

  return content;
}

// System prompts
const SYSTEM_PROMPT = `You are an expert full-stack web developer specializing in modern, responsive web design.

CRITICAL REQUIREMENTS:
1. Use ONLY semantic HTML5 elements (header, nav, main, section, article, footer, etc.)
2. Use MODERN CSS: Flexbox, CSS Grid, CSS Variables, media queries for responsiveness
3. NEVER use table-based layouts, <font> tags, or MSO tags
4. NEVER use inline styles except for dynamic values
5. Use external CSS classes and modern design patterns
6. Ensure mobile-first responsive design
7. Include proper viewport meta tag
8. Use modern JavaScript (ES6+) with event listeners, not inline onclick
9. Follow accessibility best practices (ARIA labels, semantic structure)
10. Optimize for performance (lazy loading, efficient selectors)

OUTPUT FORMAT:
- Return ONLY the raw code for each file
- No markdown formatting
- No explanations
- No \`\`\` code blocks`;

const MANIFEST_SYSTEM_PROMPT = `You are a project architect. Analyze the user's request and create a detailed plan for a modern web project.

Respond with a JSON object in this EXACT format (no markdown, no extra text):
{
  "structure": "single-page" | "multi-page" | "app",
  "files": [
    {
      "path": "index.html",
      "language": "html",
      "isMain": true,
      "description": "Main HTML file with semantic structure"
    },
    {
      "path": "styles/main.css",
      "language": "css",
      "isMain": false,
      "description": "Main stylesheet with CSS variables and responsive design"
    },
    {
      "path": "scripts/main.js",
      "language": "javascript",
      "isMain": false,
      "description": "Main JavaScript for interactivity"
    }
  ],
  "description": "Brief project description",
  "totalFiles": 3
}

RULES:
- Always include index.html as the main file
- Separate CSS into its own file(s)
- Separate JavaScript into its own file(s)
- Use relative paths
- Keep structure simple but scalable
- Only include necessary files`;
