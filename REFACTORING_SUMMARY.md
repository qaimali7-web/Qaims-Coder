# Qaim's Coder - Advanced Web Generation Refactoring

## Overview
This document summarizes the comprehensive refactoring of Qaim's Coder to support advanced multi-component website generation using a "Project Architect" workflow.

## Key Improvements

### 1. Multi-File Project Support
- **Before**: Single-page HTML snippets only
- **After**: Full multi-file projects with separate HTML, CSS, and JavaScript files

**New Types** (`src/types.ts`):
- `ProjectFile`: Represents individual project files with path, content, language, and order
- `ProjectManifest`: JSON structure describing the complete project layout
- `GenerationProgress`: Real-time progress tracking during generation

### 2. Project Architect Workflow
- **Plan Phase**: AI generates a project manifest (JSON) specifying all required files
- **Execute Phase**: Files are generated sequentially with context from previous files
- **Streaming Updates**: Real-time progress via Server-Sent Events (SSE)

**New API Endpoint** (`api/build-site.ts`):
- POST `/api/build-site` - Streaming endpoint with SSE
- Generates manifest first, then each file with context
- Sends progress events: `planning`, `generating`, `finalizing`, `complete`, `error`

### 3. Modernized System Prompts
**HTML5/CSS3 Enforcement**:
- Semantic HTML5 elements only (header, nav, main, section, article, footer)
- Modern CSS: Flexbox, Grid, CSS Variables, media queries
- **Strictly forbidden**: Table layouts, MSO tags, `<font>` tags, inline styles
- Mobile-first responsive design
- Accessibility best practices (ARIA labels, semantic structure)

### 4. Enhanced Error Handling
**New Error Boundary** (`src/components/ErrorBoundary.tsx`):
- Catches and displays errors with user-friendly messages
- Classifies errors: `context_length`, `network`, `rate_limit`, `validation`, `unknown`
- Provides contextual tips (e.g., "Try breaking your request into smaller parts")
- Stack trace logging for debugging

**API Error Types** (`src/types.ts`):
```typescript
interface ApiError {
  type: 'context_length' | 'network' | 'rate_limit' | 'server' | 'validation' | 'unknown';
  message: string;
  details?: any;
  statusCode?: number;
}
```

### 5. File Explorer UI
**New Component** (`src/components/FileExplorer.tsx`):
- Tree view showing project file structure
- Color-coded file icons by language (HTML=orange, CSS=blue, JS=yellow, TS=blue)
- Main file indicator badge
- Click to switch between files
- Directory grouping

### 6. Loading Progress Indicator
**New Component** (`src/components/LoadingProgress.tsx`):
- Progress bar with percentage
- Current file being generated
- File count (e.g., "2/3 files")
- Stage indicators: planning, generating, finalizing, complete, error
- Color-coded by state (blue=active, green=success, red=error)

### 7. Updated Database Schema
**Convex Schema Changes** (`convex/schema.ts`):
- New `projectFiles` table: stores individual project files
- Extended `generations` table: now stores `manifest` (JSON), `progress` (JSON), `status`
- Backward compatible: legacy `storeGeneration` still works

**New Convex Mutations** (`convex/generations.ts`):
- `createProjectManifest`: Initialize generation record
- `storeProjectFiles`: Save multiple files
- `updateGenerationProgress`: Real-time progress updates
- `completeGeneration`: Mark generation as complete
- `failGeneration`: Mark generation as failed
- `getProjectFilesOrdered`: Retrieve files in generation order

### 8. Streaming Response Support
- Server-Sent Events (SSE) prevent timeouts for large projects
- Client-side streaming parser in `App.tsx`
- Automatic reconnection handling
- Progress updates every 100-300ms

## File Structure Changes

### New Files Created:
1. `api/build-site.ts` - Main API endpoint for multi-file generation
2. `src/components/FileExplorer.tsx` - File tree navigation
3. `src/components/LoadingProgress.tsx` - Progress bar component
4. `src/components/ErrorBoundary.tsx` - Error handling wrapper
5. `REFACTORING_SUMMARY.md` - This document

### Modified Files:
1. `src/types.ts` - Added multi-file project types
2. `convex/schema.ts` - Added projectFiles table, extended generations
3. `convex/generations.ts` - New mutations for multi-file workflow
4. `server.js` - Added `/api/build-site` route
5. `src/App.tsx` - Integrated new UI components and streaming logic
6. `src/components/agents/CodeAssistant.tsx` - (Future: will be updated for multi-file)

## API Changes

### New Endpoint: POST `/api/build-site`
**Request**:
```json
{
  "prompt": "Build a coffee shop site",
  "projectId": "project-123",
  "model": "stepfun/step-3.5-flash:free"
}
```

**Response**: Server-Sent Events stream
```
data: {"type":"progress","progress":{"stage":"planning","message":"Analyzing...","percentage":10}}
data: {"type":"file_complete","filePath":"index.html","content":"<html>...</html>"}
data: {"type":"file_complete","filePath":"styles/main.css","content":"body { ... }"}
data: {"type":"complete","manifest":{...},"files":[...]}
data: {"type":"error","error":{"type":"context_length","message":"..."}}
```

## Usage

### For Users:
1. Enter a complex prompt (e.g., "Build a coffee shop site with menu and contact form")
2. Watch the progress bar as the AI plans and generates each file
3. Click on files in the explorer to switch between them
4. Edit, preview, and download the complete multi-file project

### For Developers:
1. The new `/api/build-site` endpoint handles streaming generation
2. Convex stores files in `projectFiles` table
3. Frontend consumes SSE and updates state in real-time
4. Error boundaries catch and display errors gracefully

## Backward Compatibility
- Legacy `/api/generate` endpoint still works for single-file generation
- Old `storeGeneration` mutation automatically wraps single-file code in a manifest
- Existing UI elements (Code Assistant, Image Generator) unchanged

## Testing Checklist
- [x] TypeScript compilation passes
- [ ] API endpoint returns valid SSE stream
- [ ] Manifest generation creates valid JSON
- [ ] Files are generated with proper context
- [ ] File explorer displays correct file tree
- [ ] Progress bar updates smoothly
- [ ] Error boundary catches and displays errors
- [ ] Multi-file projects can be downloaded as ZIP
- [ ] Preview works with multi-file structure

## Performance Considerations
- Streaming prevents timeout for large projects (8k+ tokens per file)
- Progress updates every 100-300ms to reduce UI thrashing
- Files stored in order for proper dependency resolution
- Auto-selects main file (index.html) for preview

## Future Enhancements
1. ZIP download for complete project
2. File editing with auto-save to Convex
3. Diff view between versions
4. AI-powered file refactoring
5. Template system for common project types
6. Integration with Vercel/Netlify for one-click deploy

## Migration Notes
If you have existing projects:
- Single-file generations are automatically converted to manifest format
- No manual migration needed
- Old code can still be downloaded as single HTML file

## Environment Variables Required
```env
OPENROUTER_API_KEY=your_key_here
CONVEX_URL=your_convex_url
CONVEX_API_KEY=your_convex_key
SITE_URL=https://your-app.vercel.app
```

## Deployment
1. Push changes to Vercel/Netlify
2. Run `npx convex deploy` to update Convex schema
3. Ensure environment variables are set
4. Restart server if using custom Express server

## Support
For issues or questions, refer to the original project repository or contact the development team.
