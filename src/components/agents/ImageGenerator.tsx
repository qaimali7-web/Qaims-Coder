// src/components/agents/ImageGenerator.tsx
import React, { useState, useCallback } from 'react';
import { Image, Download, Trash2, Loader2, Palette, Sparkles } from 'lucide-react';
import { useConvex } from '../../hooks/useConvex';
import { useToasts } from '../../hooks/usetoasts';

interface ImageGeneratorProps {
  projectId: string;
  onNewProject?: () => void;
}

interface GeneratedImage {
  _id: string;
  prompt: string;
  imageUrl: string;
  model: string;
  style?: string;
  width: number;
  height: number;
  createdAt: number;
}

export const ImageGenerator: React.FC<ImageGeneratorProps> = ({
  projectId,
  onNewProject
}) => {
  const [prompt, setPrompt] = useState('');
  const [selectedStyle, setSelectedStyle] = useState('default');
  const [selectedModel, setSelectedModel] = useState('stability-ai/sdxl-turbo');
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { createImage, getImagesByProject } = useConvex();
  const { showToast } = useToasts();

  const loadImages = useCallback(async () => {
    try {
      const images = await getImagesByProject(projectId);
      setGeneratedImages(images);
    } catch (err) {
      console.error('Failed to load images:', err);
    }
  }, [projectId, getImagesByProject]);

  // Load images on mount
  React.useEffect(() => {
    loadImages();
  }, [loadImages]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/chat/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          model: selectedModel,
          style: selectedStyle === 'default' ? undefined : selectedStyle,
          width: 1024,
          height: 1024,
          projectId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `API error: ${response.status}`);
      }

      const data = await response.json();

      // Save image record to Convex
      await createImage(
        projectId,
        prompt.trim(),
        data.imageUrl,
        data.model,
        selectedStyle === 'default' ? undefined : selectedStyle,
        data.width,
        data.height
      );

      // Reload images
      await loadImages();

      setPrompt('');
      showToast('Image generated successfully');

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to generate image';
      setError(errorMsg);
      console.error('Image generation error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteImage = async (imageId: string) => {
    if (!confirm('Are you sure you want to delete this image?')) return;

    try {
      // Would need deleteImage function in useConvex
      // For now, just remove from local state
      setGeneratedImages(prev => prev.filter(img => img._id !== imageId));
      showToast('Image deleted');
    } catch (err) {
      console.error('Failed to delete image:', err);
      showToast('Failed to delete image');
    }
  };

  const handleDownloadImage = async (imageUrl: string, filename: string) => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `image-${filename}-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Image downloaded');
    } catch (err) {
      console.error('Failed to download image:', err);
      showToast('Failed to download image');
    }
  };

  const STYLES = [
    { value: 'default', label: 'Default' },
    { value: 'realistic', label: 'Realistic' },
    { value: 'cartoon', label: 'Cartoon' },
    { value: 'pixel-art', label: 'Pixel Art' },
    { value: 'watercolor', label: 'Watercolor' },
    { value: 'sketch', label: 'Sketch' },
    { value: '3d-render', label: '3D Render' },
  ];

  const MODELS = [
    { value: 'stability-ai/sdxl-turbo', label: 'SDXL Turbo' },
    { value: 'openai/dall-e-3', label: 'DALL-E 3' },
    { value: 'midjourney/midjourney', label: 'Midjourney' },
  ];

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      {/* Header */}
      <div className="h-[50px] flex items-center justify-between px-5 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <Image className="w-5 h-5 text-indigo-500" aria-hidden="true" />
          <span className="font-semibold text-sm text-slate-50">Image Generator</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onNewProject}
            className="px-3 py-1.5 text-xs font-medium bg-zinc-800 hover:bg-zinc-700 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            New Project
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="p-4 border-b border-zinc-800 bg-zinc-900">
        <form onSubmit={handleGenerate} className="space-y-4">
          <div>
            <label htmlFor="prompt" className="block text-xs font-semibold text-slate-400 uppercase mb-2">
              Describe your image
            </label>
            <textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-sm focus:outline-none focus:border-indigo-500 transition-colors resize-none"
              placeholder="A majestic mountain landscape at sunset with a crystal lake..."
              rows={3}
              disabled={isLoading}
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label htmlFor="style-select" className="block text-xs font-semibold text-slate-400 uppercase mb-2">
                Style
              </label>
              <select
                id="style-select"
                value={selectedStyle}
                onChange={(e) => setSelectedStyle(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                disabled={isLoading}
              >
                {STYLES.map(style => (
                  <option key={style.value} value={style.value}>{style.label}</option>
                ))}
              </select>
            </div>

            <div className="flex-1">
              <label htmlFor="model-select" className="block text-xs font-semibold text-slate-400 uppercase mb-2">
                Model
              </label>
              <select
                id="model-select"
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                disabled={isLoading}
              >
                {MODELS.map(model => (
                  <option key={model.value} value={model.value}>{model.label}</option>
                ))}
              </select>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-sm text-red-400">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || !prompt.trim()}
            className="w-full flex items-center justify-center gap-2 p-3 rounded-lg font-semibold bg-gradient-to-br from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600 disabled:from-zinc-700 disabled:to-zinc-700 disabled:cursor-not-allowed transition-all focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                Generate Image
              </>
            )}
          </button>
        </form>
      </div>

      {/* Image Gallery */}
      <div className="flex-1 overflow-y-auto p-4">
        {generatedImages.length === 0 ? (
          <div className="text-center text-slate-500 mt-10">
            <Image className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-semibold mb-2">No Images Yet</h3>
            <p className="text-sm max-w-md mx-auto">
              Enter a description above and click Generate to create your first image.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {generatedImages.map((image) => (
              <div
                key={image._id}
                className="bg-zinc-800 rounded-lg overflow-hidden border border-zinc-700"
              >
                <div className="relative aspect-square">
                  <img
                    src={image.imageUrl}
                    alt={image.prompt}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
                <div className="p-3">
                  <p className="text-sm text-slate-300 mb-2 line-clamp-2">
                    {image.prompt}
                  </p>
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>{new Date(image.createdAt).toLocaleDateString()}</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleDownloadImage(image.imageUrl, image._id)}
                        className="p-1.5 hover:bg-zinc-700 rounded transition-colors"
                        title="Download image"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteImage(image._id)}
                        className="p-1.5 hover:bg-red-500/20 text-red-400 rounded transition-colors"
                        title="Delete image"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
