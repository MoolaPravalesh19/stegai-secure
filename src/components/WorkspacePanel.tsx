import React, { useState, useCallback } from 'react';
import { Lock, Unlock, Loader2, Sparkles, Key, Eye, EyeOff, Download, ImageIcon } from 'lucide-react';
import GlassCard from './GlassCard';
import ImageUploader from './ImageUploader';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { toast } from '@/hooks/use-toast';

const WorkspacePanel: React.FC = () => {
  const [sourceImage, setSourceImage] = useState<File | null>(null);
  const [encryptedImage, setEncryptedImage] = useState<File | null>(null);
  const [encryptionKey, setEncryptionKey] = useState('');
  const [decryptionKey, setDecryptionKey] = useState('');
  const [showEncryptionKey, setShowEncryptionKey] = useState(false);
  const [showDecryptionKey, setShowDecryptionKey] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [encryptedImageUrl, setEncryptedImageUrl] = useState<string | null>(null);
  const [decryptedImageUrl, setDecryptedImageUrl] = useState<string | null>(null);
  const [encryptionTime, setEncryptionTime] = useState<number | null>(null);
  const [decryptionTime, setDecryptionTime] = useState<number | null>(null);

  // Generate seed from key using simple hash
  const generateSeed = (key: string): number => {
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      const char = key.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash) || 12345;
  };

  // Seeded random number generator
  const seededRandom = (seed: number) => {
    let s = seed;
    return () => {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s / 0x7fffffff;
    };
  };

  // Fisher-Yates shuffle with seed
  const shuffleArray = (array: number[], seed: number): number[] => {
    const shuffled = [...array];
    const random = seededRandom(seed);
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  // Reverse shuffle (unshuffle)
  const unshuffleArray = (array: Uint8ClampedArray, shuffleMap: number[]): Uint8ClampedArray => {
    const result = new Uint8ClampedArray(array.length);
    for (let i = 0; i < shuffleMap.length; i++) {
      const srcIdx = shuffleMap[i] * 4;
      const destIdx = i * 4;
      result[destIdx] = array[srcIdx];
      result[destIdx + 1] = array[srcIdx + 1];
      result[destIdx + 2] = array[srcIdx + 2];
      result[destIdx + 3] = array[srcIdx + 3];
    }
    return result;
  };

  const getPasswordStrength = (password: string): { score: number; label: string; color: string } => {
    if (!password) return { score: 0, label: '', color: '' };
    
    let score = 0;
    if (password.length >= 8) score += 1;
    if (password.length >= 12) score += 1;
    if (password.length >= 16) score += 1;
    if (/[a-z]/.test(password)) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^a-zA-Z0-9]/.test(password)) score += 1;
    
    if (score <= 2) return { score: 1, label: 'Weak', color: 'bg-destructive' };
    if (score <= 4) return { score: 2, label: 'Medium', color: 'bg-yellow-500' };
    if (score <= 5) return { score: 3, label: 'Strong', color: 'bg-green-500' };
    return { score: 4, label: 'Very Strong', color: 'bg-emerald-400' };
  };

  const keyStrength = getPasswordStrength(encryptionKey);

  const handleEncrypt = useCallback(async () => {
    if (!sourceImage) {
      toast({
        title: "Missing input",
        description: "Please upload an image to encrypt.",
        variant: "destructive"
      });
      return;
    }

    if (!encryptionKey) {
      toast({
        title: "Missing key",
        description: "Please enter an encryption key.",
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
      const pixels = imageData.data;
      const pixelCount = pixels.length / 4;

      // Create shuffle map
      const seed = generateSeed(encryptionKey);
      const indices = Array.from({ length: pixelCount }, (_, i) => i);
      const shuffledIndices = shuffleArray(indices, seed);

      // Shuffle pixels
      const newPixels = new Uint8ClampedArray(pixels.length);
      for (let i = 0; i < pixelCount; i++) {
        const srcIdx = i * 4;
        const destIdx = shuffledIndices[i] * 4;
        newPixels[destIdx] = pixels[srcIdx];
        newPixels[destIdx + 1] = pixels[srcIdx + 1];
        newPixels[destIdx + 2] = pixels[srcIdx + 2];
        newPixels[destIdx + 3] = pixels[srcIdx + 3];
      }

      // Create encrypted image
      const newImageData = new ImageData(newPixels, canvas.width, canvas.height);
      ctx.putImageData(newImageData, 0, 0);

      const encryptedUrl = canvas.toDataURL('image/png');
      setEncryptedImageUrl(encryptedUrl);

      const endTime = performance.now();
      setEncryptionTime(Math.round(endTime - startTime));

      URL.revokeObjectURL(imageUrl);

      toast({
        title: "Encryption Complete!",
        description: `Image encrypted in ${Math.round(endTime - startTime)}ms`,
      });
    } catch (error) {
      console.error('Encrypt error:', error);
      toast({
        title: "Encryption Failed",
        description: error instanceof Error ? error.message : 'An error occurred during encryption.',
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  }, [sourceImage, encryptionKey]);

  const handleDecrypt = useCallback(async () => {
    if (!encryptedImage) {
      toast({
        title: "Missing input",
        description: "Please upload an encrypted image to decrypt.",
        variant: "destructive"
      });
      return;
    }

    if (!decryptionKey) {
      toast({
        title: "Missing key",
        description: "Please enter the decryption key.",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    setDecryptedImageUrl(null);
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
      const pixels = imageData.data;
      const pixelCount = pixels.length / 4;

      // Create shuffle map (same as encryption)
      const seed = generateSeed(decryptionKey);
      const indices = Array.from({ length: pixelCount }, (_, i) => i);
      const shuffledIndices = shuffleArray(indices, seed);

      // Unshuffle pixels (reverse the mapping)
      const newPixels = unshuffleArray(pixels, shuffledIndices);

      // Create decrypted image
      const newImageData = new ImageData(new Uint8ClampedArray(newPixels), canvas.width, canvas.height);
      ctx.putImageData(newImageData, 0, 0);

      const decryptedUrl = canvas.toDataURL('image/png');
      setDecryptedImageUrl(decryptedUrl);

      const endTime = performance.now();
      setDecryptionTime(Math.round(endTime - startTime));

      URL.revokeObjectURL(imageUrl);

      toast({
        title: "Decryption Complete!",
        description: `Image decrypted in ${Math.round(endTime - startTime)}ms`,
      });
    } catch (error) {
      console.error('Decrypt error:', error);
      toast({
        title: "Decryption Failed",
        description: error instanceof Error ? error.message : 'An error occurred during decryption.',
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  }, [encryptedImage, decryptionKey]);

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
      {/* Encryption Panel */}
      <GlassCard className="transition-all duration-300">
        <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
          <div className="p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-primary/10 border border-primary/20">
            <Lock className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
          </div>
          <div>
            <h2 className="font-mono font-bold text-lg sm:text-xl text-foreground">Encrypt Image</h2>
            <p className="text-xs sm:text-sm text-muted-foreground">Shuffle pixels to encrypt</p>
          </div>
        </div>
        
        <div className="space-y-4 sm:space-y-5">
          <ImageUploader 
            label="Source Image" 
            onImageSelect={setSourceImage}
          />
          
          <div>
            <label className="text-xs sm:text-sm font-medium text-muted-foreground mb-2 block flex items-center gap-2">
              <Key className="w-3 h-3 sm:w-4 sm:h-4" />
              Encryption Key
            </label>
            <div className="relative">
              <Input
                type={showEncryptionKey ? "text" : "password"}
                placeholder="Enter encryption key..."
                value={encryptionKey}
                onChange={(e) => setEncryptionKey(e.target.value)}
                className="bg-muted/30 border-border/50 focus:border-primary/50 focus:ring-primary/20 font-mono text-xs sm:text-sm pr-10"
              />
              <button
                type="button"
                onClick={() => setShowEncryptionKey(!showEncryptionKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showEncryptionKey ? <EyeOff className="w-3 h-3 sm:w-4 sm:h-4" /> : <Eye className="w-3 h-3 sm:w-4 sm:h-4" />}
              </button>
            </div>
            {encryptionKey && (
              <div className="mt-3 space-y-2">
                <div className="flex gap-1">
                  {[1, 2, 3, 4].map((level) => (
                    <div
                      key={level}
                      className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                        level <= keyStrength.score ? keyStrength.color : 'bg-muted/50'
                      }`}
                    />
                  ))}
                </div>
                <p className={`text-xs font-medium ${
                  keyStrength.score === 1 ? 'text-destructive' :
                  keyStrength.score === 2 ? 'text-yellow-500' :
                  'text-green-500'
                }`}>
                  {keyStrength.label}
                </p>
              </div>
            )}
          </div>
          
          <Button 
            variant="cyber" 
            size="lg" 
            className="w-full text-sm sm:text-base"
            onClick={handleEncrypt}
            disabled={isProcessing || !sourceImage || !encryptionKey}
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                <span className="ml-2">Encrypting...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="ml-2">Encrypt Image</span>
              </>
            )}
          </Button>

          {/* Encrypted Image Result */}
          {encryptedImageUrl && (
            <div className="p-3 sm:p-4 rounded-lg sm:rounded-xl bg-primary/10 border border-primary/20 animate-fade-in space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Lock className="w-3 h-3 sm:w-4 sm:h-4 text-primary" />
                  <span className="text-xs sm:text-sm font-medium text-primary">Encrypted Image</span>
                  {encryptionTime && (
                    <span className="text-xs text-muted-foreground">({encryptionTime}ms)</span>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownload(encryptedImageUrl, `encrypted_${Date.now()}.png`)}
                  className="text-xs"
                >
                  <Download className="w-3 h-3 mr-1" />
                  Download
                </Button>
              </div>
              <img 
                src={encryptedImageUrl} 
                alt="Encrypted image" 
                className="w-full h-32 sm:h-40 object-cover rounded-lg border border-border/50"
              />
            </div>
          )}
        </div>
      </GlassCard>

      {/* Decryption Panel */}
      <GlassCard className="transition-all duration-300">
        <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
          <div className="p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-secondary/10 border border-secondary/20">
            <Unlock className="w-5 h-5 sm:w-6 sm:h-6 text-secondary" />
          </div>
          <div>
            <h2 className="font-mono font-bold text-lg sm:text-xl text-foreground">Decrypt Image</h2>
            <p className="text-xs sm:text-sm text-muted-foreground">Restore original image</p>
          </div>
        </div>
        
        <div className="space-y-4 sm:space-y-5">
          <ImageUploader 
            label="Encrypted Image" 
            onImageSelect={setEncryptedImage}
          />
          
          <div>
            <label className="text-xs sm:text-sm font-medium text-muted-foreground mb-2 block flex items-center gap-2">
              <Key className="w-3 h-3 sm:w-4 sm:h-4" />
              Decryption Key
            </label>
            <div className="relative">
              <Input
                type={showDecryptionKey ? "text" : "password"}
                placeholder="Enter decryption key..."
                value={decryptionKey}
                onChange={(e) => setDecryptionKey(e.target.value)}
                className="bg-muted/30 border-border/50 focus:border-secondary/50 focus:ring-secondary/20 font-mono text-xs sm:text-sm pr-10"
              />
              <button
                type="button"
                onClick={() => setShowDecryptionKey(!showDecryptionKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showDecryptionKey ? <EyeOff className="w-3 h-3 sm:w-4 sm:h-4" /> : <Eye className="w-3 h-3 sm:w-4 sm:h-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-1 sm:mt-2">
              Enter the same key used during encryption
            </p>
          </div>
          
          <Button 
            variant="secondary" 
            size="lg" 
            className="w-full text-sm sm:text-base"
            onClick={handleDecrypt}
            disabled={isProcessing || !encryptedImage || !decryptionKey}
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                <span className="ml-2">Decrypting...</span>
              </>
            ) : (
              <>
                <ImageIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="ml-2">Decrypt Image</span>
              </>
            )}
          </Button>
          
          {/* Decrypted Image Result */}
          {decryptedImageUrl && (
            <div className="p-3 sm:p-4 rounded-lg sm:rounded-xl bg-secondary/10 border border-secondary/20 animate-fade-in space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Unlock className="w-3 h-3 sm:w-4 sm:h-4 text-secondary" />
                  <span className="text-xs sm:text-sm font-medium text-secondary">Decrypted Image</span>
                  {decryptionTime && (
                    <span className="text-xs text-muted-foreground">({decryptionTime}ms)</span>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownload(decryptedImageUrl, `decrypted_${Date.now()}.png`)}
                  className="text-xs"
                >
                  <Download className="w-3 h-3 mr-1" />
                  Download
                </Button>
              </div>
              <img 
                src={decryptedImageUrl} 
                alt="Decrypted image" 
                className="w-full h-32 sm:h-40 object-cover rounded-lg border border-border/50"
              />
            </div>
          )}
        </div>
      </GlassCard>
    </div>
  );
};

export default WorkspacePanel;
