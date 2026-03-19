// src/components/FileExplorer.tsx
import React from 'react';
import { FileCode, Folder, ChevronRight, ChevronDown } from 'lucide-react';
import { ProjectFile } from '../types';

interface FileExplorerProps {
  files: ProjectFile[];
  activeFile: string | null;
  onFileSelect: (path: string) => void;
}

export const FileExplorer: React.FC<FileExplorerProps> = ({
  files,
  activeFile,
  onFileSelect,
}) => {
  // Group files by directory
  const fileTree = React.useMemo(() => {
    const tree: Record<string, ProjectFile[]> = {};
    
    (files as ProjectFile[]).forEach(file => {
      const dir = file.path.includes('/')
        ? file.path.substring(0, file.path.lastIndexOf('/'))
        : '/';
      
      if (!tree[dir]) {
        tree[dir] = [];
      }
      tree[dir].push(file);
    });
    
    return tree;
  }, [files]);

  const getFileIcon = (language: string) => {
    const iconClass = "w-4 h-4 mr-2 flex-shrink-0";
    switch (language) {
      case 'html': return <FileCode className={`${iconClass} text-orange-400`} />;
      case 'css': return <FileCode className={`${iconClass} text-blue-400`} />;
      case 'javascript': 
      case 'js': return <FileCode className={`${iconClass} text-yellow-400`} />;
      case 'typescript':
      case 'ts': return <FileCode className={`${iconClass} text-blue-500`} />;
      default: return <FileCode className={iconClass} />;
    }
  };

  const getFileName = (path: string) => {
    return path.split('/').pop() || path;
  };

  return (
    <div className="file-explorer h-full flex flex-col bg-[#1e1e1e] border-r border-gray-800">
      <div className="p-3 border-b border-gray-800">
        <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
          Project Files
        </h3>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2">
        {Object.entries(fileTree).map(([dir, dirFiles]) => (
          <div key={dir} className="mb-2">
            <div className="flex items-center text-gray-400 text-sm py-1 px-2">
              <Folder className="w-4 h-4 mr-2" />
              {dir === '/' ? 'Root' : dir}
            </div>
            
            <div className="ml-4">
              {(dirFiles as ProjectFile[])
                .sort((a, b) => {
                  // Main file first, then by order, then alphabetically
                  if (a.isMain && !b.isMain) return -1;
                  if (!a.isMain && b.isMain) return 1;
                  const orderDiff = (a.order ?? 0) - (b.order ?? 0);
                  return orderDiff !== 0 ? orderDiff : a.path.localeCompare(b.path);
                })
                .map(file => (
                  <div
                    key={file.path}
                    className={`flex items-center py-1 px-2 cursor-pointer rounded transition-colors ${
                      activeFile === file.path
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-300 hover:bg-gray-800'
                    }`}
                    onClick={() => onFileSelect(file.path)}
                  >
                    {getFileIcon(file.language)}
                    <span className="text-sm truncate">{getFileName(file.path)}</span>
                    {file.isMain && (
                      <span className="ml-auto text-xs bg-blue-500 px-1.5 py-0.5 rounded">
                        main
                      </span>
                    )}
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
