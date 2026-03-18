import { cn } from '@/lib/utils';
import { File, FileText, Image as ImageIcon, Upload, X } from 'lucide-react';
import React, { useRef, useState } from 'react';

interface FileUploadProps {
  label?: string;
  accept?: string;
  multiple?: boolean;
  onChange?: (files: FileList | null) => void;
  error?: string;
  disabled?: boolean;
  maxSize?: number; // in MB
  className?: string;
  id?: string; // Added for better accessibility
}

export const FileUpload = ({
  label,
  accept = '*',
  multiple = false,
  onChange,
  error,
  disabled = false,
  maxSize = 10,
  className,
  id,
}: FileUploadProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [dragActive, setDragActive] = useState(false);
  
  // Generate unique IDs for accessibility
  const inputId = id || `file-upload-${Math.random().toString(36).substr(2, 9)}`;
  const errorId = `${inputId}-error`;
  const descriptionId = `${inputId}-description`;

  const handleFiles = (files: FileList | null) => {
    if (!files) return;

    const filesArray = Array.from(files);
    const validFiles = filesArray.filter((file) => {
      if (file.size > maxSize * 1024 * 1024) {
        alert(`${file.name} is too large. Maximum size is ${maxSize}MB`);
        return false;
      }
      return true;
    });

    setSelectedFiles(validFiles);

    // Create a new FileList-like object
    const dataTransfer = new DataTransfer();
    validFiles.forEach(file => dataTransfer.items.add(file));

    onChange?.(dataTransfer.files);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (disabled) return;

    const files = e.dataTransfer.files;
    handleFiles(files);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
  };

  const handleRemove = (index: number) => {
    const newFiles = selectedFiles.filter((_, i) => i !== index);
    setSelectedFiles(newFiles);

    const dataTransfer = new DataTransfer();
    newFiles.forEach(file => dataTransfer.items.add(file));

    onChange?.(dataTransfer.files);
  };

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) {
      return <ImageIcon className="w-4 h-4" aria-hidden="true" />;
    }
    if (file.type === 'application/pdf') {
      return <FileText className="w-4 h-4" aria-hidden="true" />;
    }
    return <File className="w-4 h-4" aria-hidden="true" />;
  };

  return (
    <div className={cn('space-y-2', className)}>
      {label && (
        <label 
          htmlFor={inputId}
          className="block text-sm font-medium text-foreground"
        >
          {label}
        </label>
      )}

      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={cn(
          'relative border-2 border-dashed rounded-lg p-6 transition-colors',
          dragActive && 'border-primary bg-primary/5',
          !dragActive && 'border-input hover:border-primary/50',
          disabled && 'opacity-50 cursor-not-allowed',
          error && 'border-destructive'
        )}
        aria-describedby={error ? errorId : descriptionId}
        aria-invalid={error ? "true" : "false"}
      >
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleChange}
          disabled={disabled}
          className="sr-only" // Using sr-only instead of hidden for better accessibility
          aria-invalid={error ? "true" : "false"}
          aria-describedby={error ? errorId : descriptionId}
        />

        <div className="flex flex-col items-center justify-center space-y-3">
          <Upload className="w-8 h-8 text-muted-foreground" aria-hidden="true" />
          <div className="text-center">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={disabled}
              className="text-sm font-medium text-primary hover:text-primary/80 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded"
              aria-label="Choose files to upload"
            >
              Click to upload
            </button>
            <span className="text-sm text-muted-foreground" aria-hidden="true"> or drag and drop</span>
          </div>
          <p 
            id={descriptionId}
            className="text-xs text-muted-foreground"
          >
            {accept === '*' ? 'Any file type' : accept.split(',').join(', ')} (Max {maxSize}MB)
          </p>
        </div>
      </div>

      {error && (
        <p 
          id={errorId}
          className="text-sm text-destructive"
          role="alert"
        >
          {error}
        </p>
      )}

      {selectedFiles.length > 0 && (
        <div className="space-y-2" role="list" aria-label="Selected files">
          {selectedFiles.map((file, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 bg-muted rounded-lg"
              role="listitem"
            >
              <div className="flex items-center space-x-3 flex-1 min-w-0">
                <div className="text-muted-foreground" aria-hidden="true">
                  {getFileIcon(file)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleRemove(index)}
                className="ml-2 p-1 hover:bg-destructive/10 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-destructive focus:ring-offset-2"
                disabled={disabled}
                aria-label={`Remove ${file.name}`}
              >
                <X className="w-4 h-4 text-destructive" aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};