import React, { useRef } from 'react';
import { Button } from './button';
import { ImageWithFallback } from '../figma/ImageWithFallback';
import { Upload, X, FileText } from 'lucide-react';

interface FileUploadFieldProps {
  currentUrl: string | null | undefined;
  accept: string;
  onChange: (file: File | null) => void;
  previewType?: 'image' | 'link';
  label?: string;
}

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3002/api';

function resolveUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  if (url.startsWith('/uploads/')) return `${API_BASE_URL.replace(/\/api$/, '')}${url}`;
  return url;
}

export function FileUploadField({ currentUrl, accept, onChange, previewType = 'image', label }: FileUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    onChange(file);
    if (inputRef.current) inputRef.current.value = '';
  };

  const resolved = resolveUrl(currentUrl);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
          <Upload className="h-4 w-4 mr-1" />
          {label ?? 'Upload file'}
        </Button>
        {currentUrl && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
            <X className="h-4 w-4 mr-1" />
            Remove
          </Button>
        )}
        <input ref={inputRef} type="file" accept={accept} onChange={handleChange} className="hidden" />
      </div>
      {resolved && previewType === 'image' && (
        <ImageWithFallback src={resolved} alt="Preview" className="max-h-16 rounded border" />
      )}
      {resolved && previewType === 'link' && (
        <a href={resolved} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
          <FileText className="h-4 w-4" />
          View document
        </a>
      )}
    </div>
  );
}
