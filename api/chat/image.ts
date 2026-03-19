// api/chat/image.ts
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).send("Method not allowed");
    return;
  }

  try {
    const { prompt, model, style, width = 1024, height = 1024, projectId } = req.body;

    if (!prompt || typeof prompt !== 'string') {
      res.status(400).json({ error: 'Prompt is required' });
      return;
    }

    // Get API key from environment
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      res.status(500).json({ error: 'OpenRouter API key not configured' });
      return;
    }

    // Build style-enhanced prompt
    let enhancedPrompt = prompt;
    if (style && style !== 'default') {
      const stylePrompts = {
        'realistic': 'photorealistic, high quality, detailed, 8k',
        'cartoon': 'cartoon style, animated, vibrant colors, fun',
        'pixel-art': 'pixel art, 8-bit, retro gaming style',
        'watercolor': 'watercolor painting, soft, artistic, brush strokes',
        'sketch': 'pencil sketch, hand-drawn, rough lines',
        '3d-render': '3D render, blender, octane render, cinematic lighting',
      };
      const styleModifier = stylePrompts[style];
      if (styleModifier) {
        enhancedPrompt = `${prompt}, ${styleModifier}`;
      }
    }

    // Call OpenRouter API for image generation
    // Note: OpenRouter supports various image models. Using stability-ai/sdxl-turbo by default
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.SITE_URL || 'https://your-app.vercel.app',
        'X-Title': 'Qaims Coder - Image Generator'
      },
      body: JSON.stringify({
        model: model || 'stability-ai/sdxl-turbo',
        messages: [
          {
            role: 'user',
            content: `Generate an image based on this description: ${enhancedPrompt}. Return ONLY a valid JSON object with this structure: { "image": "base64_encoded_image_data", "format": "png", "width": ${width}, "height": ${height} }`
          }
        ],
        stream: false,
        max_tokens: 1024,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('OpenRouter API error:', errorData);
      return res.status(response.status).json({
        error: errorData.error?.message || `API error: ${response.status}`
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    // Try to parse the JSON response
    let imageData;
    try {
      // Extract JSON from the response (it might be wrapped in markdown)
      const jsonMatch = content.match(/\{.*\}/s);
      if (jsonMatch) {
        imageData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse image data:', parseError, content);
      return res.status(500).json({
        error: 'Failed to generate image: invalid response from AI model'
      });
    }

    // For now, we'll return the base64 data directly
    // In production, you'd upload to S3/Cloudflare R2 and return a URL
    const imageUrl = `data:image/${imageData.format || 'png'};base64,${imageData.image}`;

    // Store image record in Convex (optional - would need convex client)
    // await convex.mutation('images:createImage', {
    //   projectId,
    //   prompt,
    //   imageUrl,
    //   model: model || 'stability-ai/sdxl-turbo',
    //   style,
    //   width,
    //   height,
    // });

    res.status(200).json({
      success: true,
      imageUrl,
      prompt,
      model: model || 'stability-ai/sdxl-turbo',
      style,
      width: imageData.width || width,
      height: imageData.height || height,
      format: imageData.format || 'png'
    });

  } catch (error) {
    console.error('Image generation error:', error);
    res.status(500).json({
      error: `Failed to generate image: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  }
}
