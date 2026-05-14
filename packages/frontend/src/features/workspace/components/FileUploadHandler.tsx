/**
 * FileUploadHandler — Client-side file reader for .md and .txt files.
 * Supports click-to-browse and drag-and-drop. Does NOT upload to server.
 */
import { useState, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';

const ACCEPTED_EXTENSIONS = ['.md', '.txt'];
const MAX_SIZE_BYTES = 512_000; // 500 KB

export interface FileUploadHandlerProps {
  onContent: (text: string) => void;
  className?: string;
}

/**
 * Validate a file's extension and size.
 * Returns null if valid, or an error message string.
 */
export function validateFile(file: File): string | null {
  const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
  if (!ACCEPTED_EXTENSIONS.includes(ext)) {
    return 'Only .md and .txt files are supported.';
  }
  if (file.size > MAX_SIZE_BYTES) {
    return 'File size exceeds the 500 KB limit.';
  }
  return null;
}

export function FileUploadHandler({ onContent, className }: FileUploadHandlerProps) {
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback((file: File) => {
    setError(null);
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onContent(reader.result);
      }
    };
    reader.onerror = () => {
      setError('Failed to read file. Please try again.');
    };
    reader.readAsText(file);
  }, [onContent]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    // Reset input so same file can be re-selected
    if (inputRef.current) inputRef.current.value = '';
  }, [processFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragging(false);
  }, []);

  return (
    <div className={cn('space-y-1', className)}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click(); }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          'flex items-center justify-center px-3 py-2 rounded-lg border border-dashed cursor-pointer transition-colors text-xs',
          dragging
            ? 'border-accent-primary bg-[rgba(59,130,246,0.06)] text-accent-primary'
            : 'border-border-subtle bg-bg-elevated text-text-secondary hover:border-accent-primary hover:text-accent-primary',
        )}
      >
        <span>📎 Drop .md/.txt file or click to browse</span>
        <input
          ref={inputRef}
          type="file"
          accept=".md,.txt"
          onChange={handleChange}
          className="hidden"
          aria-label="Upload file"
        />
      </div>
      {error && (
        <p className="text-[11px] text-status-danger" role="alert">{error}</p>
      )}
    </div>
  );
}
