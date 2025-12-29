import React, { useState, useCallback } from 'react';
import { Upload, Image as ImageIcon, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImageUploaderProps {
  label: string;
  onImageSelect: (file: File | null) => void;
  accept?: string;
  className?: string;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({ 
  label, 
  onImageSelect, 
  accept = "image/*",
  className 
}) => {
  const [preview, setPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
    onImageSelect(file);
  }, [onImageSelect]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      handleFile(file);
    }
  }, [handleFile]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const clearImage = () => {
    setPreview(null);
    onImageSelect(null);
  };

  return (
    <div className={cn("relative", className)}>
      <label className="text-sm font-medium text-muted-foreground mb-2 block">
        {label}
      </label>
      
      {preview ? (
        <div className="relative rounded-xl overflow-hidden border border-border/50 bg-muted/30">
          <img 
            src={preview} 
            alt="Preview" 
            className="w-full h-48 object-cover"
          />
          <button
            onClick={clearImage}
            className="absolute top-2 right-2 p-1.5 rounded-full bg-background/80 hover:bg-destructive/80 transition-colors border border-border/50"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-background/90 to-transparent">
            <p className="text-xs text-muted-foreground truncate">Image uploaded</p>
          </div>
        </div>
      ) : (
        <div
          className={cn(
            "upload-zone cursor-pointer min-h-[180px]",
            isDragging && "border-primary bg-primary/5"
          )}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => document.getElementById(`file-${label}`)?.click()}
        >
          <input
            id={`file-${label}`}
            type="file"
            accept={accept}
            onChange={handleChange}
            className="hidden"
          />
          
          <div className="flex flex-col items-center gap-3">
            <div className="p-4 rounded-xl bg-muted/50 border border-border/50">
              {isDragging ? (
                <Upload className="w-8 h-8 text-primary animate-bounce" />
              ) : (
                <ImageIcon className="w-8 h-8 text-muted-foreground" />
              )}
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">
                {isDragging ? 'Drop image here' : 'Click or drag image'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                PNG, JPG up to 10MB
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageUploader;
