/**
 * Keyboard shortcuts utilities
 */

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  action: () => void;
  description: string;
}

/**
 * Registers a keyboard shortcut
 */
export function registerShortcut(shortcut: KeyboardShortcut): () => void {
  const handler = (e: KeyboardEvent) => {
    const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase();
    const ctrlMatch = shortcut.ctrl ? e.ctrlKey || e.metaKey : !(e.ctrlKey || e.metaKey);
    const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey;
    const altMatch = shortcut.alt ? e.altKey : !e.altKey;

    if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
      e.preventDefault();
      shortcut.action();
    }
  };

  document.addEventListener('keydown', handler);

  // Return cleanup function
  return () => {
    document.removeEventListener('keydown', handler);
  };
}

/**
 * Registers multiple keyboard shortcuts
 */
export function registerShortcuts(shortcuts: KeyboardShortcut[]): () => void {
  const cleanupFunctions = shortcuts.map(registerShortcut);

  // Return combined cleanup function
  return () => {
    cleanupFunctions.forEach((cleanup) => cleanup());
  };
}

/**
 * Default shortcuts for the code editor
 */
export const defaultEditorShortcuts: KeyboardShortcut[] = [
  {
    key: 's',
    ctrl: true,
    description: 'Save code to file',
    action: () => {
      // Trigger download
      const event = new CustomEvent('download-code');
      document.dispatchEvent(event);
    },
  },
  {
    key: 'f',
    ctrl: true,
    description: 'Open find/replace',
    action: () => {
      const event = new CustomEvent('open-find-replace');
      document.dispatchEvent(event);
    },
  },
  {
    key: 'Tab',
    description: 'Indent code',
    action: () => {
      // Handled by editor
    },
  },
  {
    key: 'Escape',
    description: 'Close modals/stop generation',
    action: () => {
      const event = new CustomEvent('stop-generation');
      document.dispatchEvent(event);
    },
  },
];
