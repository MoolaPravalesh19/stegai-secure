import React, { useState, useRef, useEffect } from 'react';
import { Upload, Check, AlertCircle, Brain, Loader2, CloudUpload } from 'lucide-react';
import { Button } from './ui/button';
import { 
  loadModelsFromFiles, 
  areModelsLoaded, 
  loadDefaultModels,
  uploadDefaultModels,
  hasCheckedDefaultModels,
  isLoadingDefaultModels
} from '@/lib/onnxModel';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

interface ModelUploaderProps {
  onModelsLoaded: () => void;
}

const ModelUploader: React.FC<ModelUploaderProps> = ({ onModelsLoaded }) => {
  const { user } = useAuth();
  const [hidingFile, setHidingFile] = useState<File | null>(null);
  const [revealFile, setRevealFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoaded, setIsLoaded] = useState(areModelsLoaded());
  const [isCheckingDefaults, setIsCheckingDefaults] = useState(!hasCheckedDefaultModels());
  const [isSavingDefaults, setIsSavingDefaults] = useState(false);
  
  const hidingInputRef = useRef<HTMLInputElement>(null);
  const revealInputRef = useRef<HTMLInputElement>(null);

  // Auto-load default models on mount
  useEffect(() => {
    const checkDefaultModels = async () => {
      if (areModelsLoaded()) {
        setIsLoaded(true);
        setIsCheckingDefaults(false);
        onModelsLoaded();
        return;
      }

      if (hasCheckedDefaultModels() || isLoadingDefaultModels()) {
        setIsCheckingDefaults(false);
        return;
      }

      setIsCheckingDefaults(true);
      const result = await loadDefaultModels();
      
      if (result.success) {
        setIsLoaded(true);
        onModelsLoaded();
        toast({
          title: "Neural Network Ready! 🧠",
          description: "Default models loaded automatically",
        });
      }
      
      setIsCheckingDefaults(false);
    };

    checkDefaultModels();
  }, [onModelsLoaded]);

  const handleLoadModels = async () => {
    if (!hidingFile || !revealFile) {
      toast({
        title: "Missing files",
        description: "Please upload both hiding_net.onnx and reveal_net.onnx",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    
    const result = await loadModelsFromFiles(hidingFile, revealFile);
    
    if (result.success) {
      setIsLoaded(true);
      onModelsLoaded();
      toast({
        title: "Models Loaded! 🎉",
        description: "Neural network is ready for steganography",
      });
    } else {
      toast({
        title: "Failed to load models",
        description: result.error,
        variant: "destructive"
      });
    }
    
    setIsLoading(false);
  };

  const handleSaveAsDefaults = async () => {
    if (!hidingFile || !revealFile) {
      toast({
        title: "Missing files",
        description: "Please upload both model files first",
        variant: "destructive"
      });
      return;
    }

    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please sign in to save default models",
        variant: "destructive"
      });
      return;
    }

    setIsSavingDefaults(true);
    
    const result = await uploadDefaultModels(hidingFile, revealFile);
    
    if (result.success) {
      toast({
        title: "Default Models Saved! ☁️",
        description: "These models will now load automatically for all visitors",
      });
    } else {
      toast({
        title: "Failed to save defaults",
        description: result.error,
        variant: "destructive"
      });
    }
    
    setIsSavingDefaults(false);
  };

  // Show loading state while checking for default models
  if (isCheckingDefaults) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 border border-border/50">
        <Loader2 className="w-5 h-5 text-primary animate-spin" />
        <span className="text-sm font-medium text-muted-foreground">Loading neural network...</span>
      </div>
    );
  }

  if (isLoaded) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
        <Check className="w-5 h-5 text-green-500" />
        <span className="text-sm font-medium text-green-500">Neural Network Model Loaded</span>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 rounded-xl bg-muted/30 border border-border/50">
      <div className="flex items-center gap-2">
        <Brain className="w-5 h-5 text-primary" />
        <span className="font-medium text-foreground">Load Neural Network Models</span>
      </div>
      
      <p className="text-xs text-muted-foreground">
        Upload your trained ONNX model files to enable neural steganography
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
          onClick={handleLoadModels}
          disabled={!hidingFile || !revealFile || isLoading}
          className="flex-1"
          variant="cyber"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              Loading Models...
            </>
          ) : (
            <>
              <Brain className="w-4 h-4 mr-2" />
              Load Neural Network
            </>
          )}
        </Button>
        
        {user && hidingFile && revealFile && (
          <Button
            onClick={handleSaveAsDefaults}
            disabled={isSavingDefaults || isLoading}
            variant="outline"
            className="border-primary/30 hover:border-primary/50"
          >
            {isSavingDefaults ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Saving...
              </>
            ) : (
              <>
                <CloudUpload className="w-4 h-4 mr-2" />
                Set as Default
              </>
            )}
          </Button>
        )}
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
