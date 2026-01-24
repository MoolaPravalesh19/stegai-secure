import React, { useState, useRef } from 'react';
import { Upload, Check, AlertCircle, Brain, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { loadModelsFromFiles, areModelsLoaded } from '@/lib/onnxModel';
import { toast } from '@/hooks/use-toast';

interface ModelUploaderProps {
  onModelsLoaded: () => void;
}

const ModelUploader: React.FC<ModelUploaderProps> = ({ onModelsLoaded }) => {
  const [hidingFile, setHidingFile] = useState<File | null>(null);
  const [revealFile, setRevealFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoaded, setIsLoaded] = useState(areModelsLoaded());
  
  const hidingInputRef = useRef<HTMLInputElement>(null);
  const revealInputRef = useRef<HTMLInputElement>(null);

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
      
      <Button
        onClick={handleLoadModels}
        disabled={!hidingFile || !revealFile || isLoading}
        className="w-full"
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
