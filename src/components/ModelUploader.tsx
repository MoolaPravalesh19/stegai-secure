import React, { useState, useRef, useEffect } from 'react';
import { Upload, Check, AlertCircle, Brain, Loader2, CloudUpload } from 'lucide-react';
import { Button } from './ui/button';
import { 
  loadModelsFromFiles, 
  areModelsLoaded, 
  loadDefaultModels,
  uploadDefaultModels,
  checkDefaultModelsExist
} from '@/lib/onnxModel';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

interface ModelUploaderProps {
  onModelsLoaded: () => void;
}

type ModelStatus = 'checking' | 'loading' | 'loaded' | 'not-found';

const ModelUploader: React.FC<ModelUploaderProps> = ({ onModelsLoaded }) => {
  const { user } = useAuth();
  const [hidingFile, setHidingFile] = useState<File | null>(null);
  const [revealFile, setRevealFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSavingAndLoading, setIsSavingAndLoading] = useState(false);
  const [status, setStatus] = useState<ModelStatus>(areModelsLoaded() ? 'loaded' : 'checking');
  
  const hidingInputRef = useRef<HTMLInputElement>(null);
  const revealInputRef = useRef<HTMLInputElement>(null);

  // On mount: check storage → load if exists, otherwise show upload UI
  useEffect(() => {
    if (areModelsLoaded()) {
      setStatus('loaded');
      onModelsLoaded();
      return;
    }

    let cancelled = false;

    const init = async () => {
      setStatus('checking');
      const exists = await checkDefaultModelsExist();

      if (cancelled) return;

      if (!exists) {
        setStatus('not-found');
        return;
      }

      // Models exist in storage — download and load them
      setStatus('loading');
      const result = await loadDefaultModels();

      if (cancelled) return;

      if (result.success) {
        setStatus('loaded');
        onModelsLoaded();
        toast({
          title: "Neural Network Ready! 🧠",
          description: "Default models loaded from storage",
        });
      } else {
        setStatus('not-found');
        toast({
          title: "Failed to load models",
          description: result.error,
          variant: "destructive"
        });
      }
    };

    init();
    return () => { cancelled = true; };
  }, [onModelsLoaded]);

  // Upload → save as default → load into runtime
  const handleUploadAndSetDefault = async () => {
    if (!hidingFile || !revealFile) {
      toast({
        title: "Missing files",
        description: "Please upload both hiding_net.onnx and reveal_net.onnx",
        variant: "destructive"
      });
      return;
    }

    setIsSavingAndLoading(true);

    // 1. Upload to storage as defaults
    const uploadResult = await uploadDefaultModels(hidingFile, revealFile);
    if (!uploadResult.success) {
      toast({
        title: "Upload failed",
        description: uploadResult.error,
        variant: "destructive"
      });
      setIsSavingAndLoading(false);
      return;
    }

    // 2. Load into runtime
    const loadResult = await loadModelsFromFiles(hidingFile, revealFile);
    if (loadResult.success) {
      setStatus('loaded');
      onModelsLoaded();
      toast({
        title: "Models Ready! 🎉",
        description: "Models saved as default and loaded for use",
      });
    } else {
      toast({
        title: "Models saved but failed to load",
        description: loadResult.error,
        variant: "destructive"
      });
    }

    setIsSavingAndLoading(false);
  };

  // Just load locally without saving
  const handleLoadOnly = async () => {
    if (!hidingFile || !revealFile) {
      toast({
        title: "Missing files",
        description: "Please upload both hiding_net.onnx and reveal_net.onnx",
        variant: "destructive"
      });
      return;
    }

    setIsUploading(true);
    
    const result = await loadModelsFromFiles(hidingFile, revealFile);
    
    if (result.success) {
      setStatus('loaded');
      onModelsLoaded();
      toast({
        title: "Models Loaded! 🎉",
        description: "Neural network is ready (not saved as default)",
      });
    } else {
      toast({
        title: "Failed to load models",
        description: result.error,
        variant: "destructive"
      });
    }
    
    setIsUploading(false);
  };

  // Checking storage
  if (status === 'checking') {
    return (
      <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 border border-border/50">
        <Loader2 className="w-5 h-5 text-primary animate-spin" />
        <span className="text-sm font-medium text-muted-foreground">Checking for neural network models...</span>
      </div>
    );
  }

  // Downloading & loading from storage
  if (status === 'loading') {
    return (
      <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 border border-border/50">
        <Loader2 className="w-5 h-5 text-primary animate-spin" />
        <span className="text-sm font-medium text-muted-foreground">Loading neural network models...</span>
      </div>
    );
  }

  // Loaded successfully
  if (status === 'loaded') {
    return (
      <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
        <Check className="w-5 h-5 text-green-500" />
        <span className="text-sm font-medium text-green-500">Neural Network Model Loaded</span>
      </div>
    );
  }

  // Not found — show upload UI
  return (
    <div className="space-y-4 p-4 rounded-xl bg-muted/30 border border-border/50">
      <div className="flex items-center gap-2">
        <Brain className="w-5 h-5 text-primary" />
        <span className="font-medium text-foreground">Upload Neural Network Models</span>
      </div>
      
      <p className="text-xs text-muted-foreground">
        No default models found. Upload your trained ONNX models to get started. They will be saved as defaults for future use.
      </p>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Hiding Net Upload */}
        <div 
          className={`p-3 rounded-lg border-2 border-dashed cursor-pointer transition-all ${
            hidingFile 
              ? 'border-primary/50 bg-primary/5' 
              : 'border-border/50 hover:border-primary/30'
          }`}
          onClick={() => hidingInputRef.current?.click()}
        >
          <input
            ref={hidingInputRef}
            type="file"
            accept=".onnx"
            className="hidden"
            onChange={(e) => setHidingFile(e.target.files?.[0] || null)}
          />
          <div className="flex flex-col items-center gap-2 text-center">
            {hidingFile ? (
              <>
                <Check className="w-6 h-6 text-primary" />
                <span className="text-xs font-medium text-primary truncate max-w-full">
                  {hidingFile.name}
                </span>
              </>
            ) : (
              <>
                <Upload className="w-6 h-6 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">hiding_net.onnx</span>
              </>
            )}
          </div>
        </div>
        
        {/* Reveal Net Upload */}
        <div 
          className={`p-3 rounded-lg border-2 border-dashed cursor-pointer transition-all ${
            revealFile 
              ? 'border-secondary/50 bg-secondary/5' 
              : 'border-border/50 hover:border-secondary/30'
          }`}
          onClick={() => revealInputRef.current?.click()}
        >
          <input
            ref={revealInputRef}
            type="file"
            accept=".onnx"
            className="hidden"
            onChange={(e) => setRevealFile(e.target.files?.[0] || null)}
          />
          <div className="flex flex-col items-center gap-2 text-center">
            {revealFile ? (
              <>
                <Check className="w-6 h-6 text-secondary" />
                <span className="text-xs font-medium text-secondary truncate max-w-full">
                  {revealFile.name}
                </span>
              </>
            ) : (
              <>
                <Upload className="w-6 h-6 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">reveal_net.onnx</span>
              </>
            )}
          </div>
        </div>
      </div>
      
      <div className="flex flex-col sm:flex-row gap-2">
        <Button
          onClick={handleUploadAndSetDefault}
          disabled={!hidingFile || !revealFile || isSavingAndLoading || isUploading}
          className="flex-1"
          variant="cyber"
        >
          {isSavingAndLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              Saving & Loading...
            </>
          ) : (
            <>
              <CloudUpload className="w-4 h-4 mr-2" />
              Save as Default & Load
            </>
          )}
        </Button>

        <Button
          onClick={handleLoadOnly}
          disabled={!hidingFile || !revealFile || isSavingAndLoading || isUploading}
          variant="outline"
          className="border-primary/30 hover:border-primary/50"
        >
          {isUploading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              Loading...
            </>
          ) : (
            <>
              <Brain className="w-4 h-4 mr-2" />
              Load Only
            </>
          )}
        </Button>
      </div>
      
      <div className="flex items-start gap-2 p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
        <AlertCircle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-yellow-600 dark:text-yellow-400">
          Export models from PyTorch using torch.onnx.export() with opset_version=11
        </p>
      </div>
    </div>
  );
};

export default ModelUploader;
