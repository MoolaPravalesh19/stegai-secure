import React, { useState, useCallback } from 'react';
import { Lock, Unlock, Loader2, Sparkles, Key, Eye, EyeOff, Download, ImageIcon, MessageSquare } from 'lucide-react';
import GlassCard from './GlassCard';
import ImageUploader from './ImageUploader';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { toast } from '@/hooks/use-toast';
import { embedText, extractText } from '@/lib/dwt-steganography';

const WorkspacePanel: React.FC = () => {
  const [sourceImage, setSourceImage] = useState<File | null>(null);
  const [encryptedImage, setEncryptedImage] = useState<File | null>(null);
  const [secretMessage, setSecretMessage] = useState('');
  const [showMessage, setShowMessage] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [encryptedImageUrl, setEncryptedImageUrl] = useState<string | null>(null);
  const [decryptedImageUrl, setDecryptedImageUrl] = useState<string | null>(null);
  const [extractedMessage, setExtractedMessage] = useState<string | null>(null);
  const [encryptionTime, setEncryptionTime] = useState<number | null>(null);
  const [decryptionTime, setDecryptionTime] = useState<number | null>(null);

  const handleEncrypt = useCallback(async () => {
    if (!sourceImage) {
      toast({
        title: "Missing input",
        description: "Please upload an image to embed the message.",
        variant: "destructive"
      });
      return;
    }

    if (!secretMessage.trim()) {
      toast({
        title: "Missing message",
        description: "Please enter a secret message to embed.",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    setEncryptedImageUrl(null);
    setEncryptionTime(null);

    const startTime = performance.now();

    try {
      const img = new Image();
      const imageUrl = URL.createObjectURL(sourceImage);
      
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = imageUrl;
      });

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      // Embed text using DWT steganography
      const stegoImageData = embedText(imageData, secretMessage);
      
      ctx.putImageData(stegoImageData, 0, 0);
      const encryptedUrl = canvas.toDataURL('image/png');
      setEncryptedImageUrl(encryptedUrl);

      const endTime = performance.now();
      setEncryptionTime(Math.round(endTime - startTime));

      URL.revokeObjectURL(imageUrl);

      toast({
        title: "Message Embedded!",
        description: `Text hidden using DWT steganography in ${Math.round(endTime - startTime)}ms`,
      });
    } catch (error) {
      console.error('Embed error:', error);
      toast({
        title: "Embedding Failed",
        description: error instanceof Error ? error.message : 'An error occurred during embedding.',
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  }, [sourceImage, secretMessage]);

  const handleDecrypt = useCallback(async () => {
    if (!encryptedImage) {
      toast({
        title: "Missing input",
        description: "Please upload a stego image to extract the message.",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    setDecryptedImageUrl(null);
    setExtractedMessage(null);
    setDecryptionTime(null);

    const startTime = performance.now();

    try {
      const img = new Image();
      const imageUrl = URL.createObjectURL(encryptedImage);
      
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = imageUrl;
      });

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      // Extract text using DWT steganography
      const message = extractText(imageData);
      
      setExtractedMessage(message);
      setDecryptedImageUrl(imageUrl);

      const endTime = performance.now();
      setDecryptionTime(Math.round(endTime - startTime));

      toast({
        title: "Message Extracted!",
        description: `Hidden text recovered in ${Math.round(endTime - startTime)}ms`,
      });
    } catch (error) {
      console.error('Extract error:', error);
      toast({
        title: "Extraction Failed",
        description: error instanceof Error ? error.message : 'No hidden message found in this image.',
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  }, [encryptedImage]);

  const handleDownload = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
      {/* Embed Panel */}
      <GlassCard className="transition-all duration-300">
        <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
          <div className="p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-primary/10 border border-primary/20">
            <Lock className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
          </div>
          <div>
            <h2 className="font-mono font-bold text-lg sm:text-xl text-foreground">Embed Message</h2>
            <p className="text-xs sm:text-sm text-muted-foreground">Hide text in image using DWT</p>
          </div>
        </div>
        
        <div className="space-y-4 sm:space-y-5">
          <ImageUploader 
            label="Cover Image" 
            onImageSelect={setSourceImage}
          />
          
          <div>
            <label className="text-xs sm:text-sm font-medium text-muted-foreground mb-2 block flex items-center gap-2">
              <MessageSquare className="w-3 h-3 sm:w-4 sm:h-4" />
              Secret Message
            </label>
            <div className="relative">
              <Textarea
                placeholder="Enter secret message to hide..."
                value={secretMessage}
                onChange={(e) => setSecretMessage(e.target.value)}
                className="bg-muted/30 border-border/50 focus:border-primary/50 focus:ring-primary/20 font-mono text-xs sm:text-sm min-h-[80px] pr-10"
                style={{ 
                  WebkitTextSecurity: showMessage ? 'none' : 'disc',
                } as React.CSSProperties}
              />
              <button
                type="button"
                onClick={() => setShowMessage(!showMessage)}
                className="absolute right-3 top-3 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showMessage ? <EyeOff className="w-3 h-3 sm:w-4 sm:h-4" /> : <Eye className="w-3 h-3 sm:w-4 sm:h-4" />}
              </button>
            </div>
            {secretMessage && (
              <p className="text-xs text-muted-foreground mt-2">
                {secretMessage.length} characters to embed
              </p>
            )}
          </div>
          
          <Button 
            variant="cyber" 
            size="lg" 
            className="w-full text-sm sm:text-base"
            onClick={handleEncrypt}
            disabled={isProcessing || !sourceImage || !secretMessage.trim()}
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                <span className="ml-2">Embedding...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="ml-2">Embed Message</span>
              </>
            )}
          </Button>

          {/* Stego Image Result */}
          {encryptedImageUrl && (
            <div className="p-3 sm:p-4 rounded-lg sm:rounded-xl bg-primary/10 border border-primary/20 animate-fade-in space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Lock className="w-3 h-3 sm:w-4 sm:h-4 text-primary" />
                  <span className="text-xs sm:text-sm font-medium text-primary">Stego Image</span>
                  {encryptionTime && (
                    <span className="text-xs text-muted-foreground">({encryptionTime}ms)</span>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownload(encryptedImageUrl, `stego_${Date.now()}.png`)}
                  className="text-xs"
                >
                  <Download className="w-3 h-3 mr-1" />
                  Download
                </Button>
              </div>
              <img 
                src={encryptedImageUrl} 
                alt="Stego image with hidden message" 
                className="w-full h-32 sm:h-40 object-cover rounded-lg border border-border/50"
              />
            </div>
          )}
        </div>
      </GlassCard>

      {/* Extract Panel */}
      <GlassCard className="transition-all duration-300">
        <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
          <div className="p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-secondary/10 border border-secondary/20">
            <Unlock className="w-5 h-5 sm:w-6 sm:h-6 text-secondary" />
          </div>
          <div>
            <h2 className="font-mono font-bold text-lg sm:text-xl text-foreground">Extract Message</h2>
            <p className="text-xs sm:text-sm text-muted-foreground">Recover hidden text from image</p>
          </div>
        </div>
        
        <div className="space-y-4 sm:space-y-5">
          <ImageUploader 
            label="Stego Image" 
            onImageSelect={setEncryptedImage}
          />
          
          <Button 
            variant="secondary" 
            size="lg" 
            className="w-full text-sm sm:text-base"
            onClick={handleDecrypt}
            disabled={isProcessing || !encryptedImage}
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                <span className="ml-2">Extracting...</span>
              </>
            ) : (
              <>
                <ImageIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="ml-2">Extract Message</span>
              </>
            )}
          </Button>
          
          {/* Extracted Message Result */}
          {extractedMessage !== null && (
            <div className="p-3 sm:p-4 rounded-lg sm:rounded-xl bg-secondary/10 border border-secondary/20 animate-fade-in space-y-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-3 h-3 sm:w-4 sm:h-4 text-secondary" />
                <span className="text-xs sm:text-sm font-medium text-secondary">Extracted Message</span>
                {decryptionTime && (
                  <span className="text-xs text-muted-foreground">({decryptionTime}ms)</span>
                )}
              </div>
              <div className="p-3 rounded-lg bg-background/50 border border-border/30">
                <p className="font-mono text-sm text-foreground break-words">
                  {extractedMessage || <span className="text-muted-foreground italic">No message found</span>}
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                {extractedMessage.length} characters extracted
              </p>
            </div>
          )}
        </div>
      </GlassCard>
    </div>
  );
};

export default WorkspacePanel;
