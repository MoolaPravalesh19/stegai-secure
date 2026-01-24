import React, { useState, useCallback } from 'react';
import { Lock, Unlock, Loader2, Sparkles, Key, Eye, EyeOff, Download, ImageIcon, MessageSquare } from 'lucide-react';
import GlassCard from './GlassCard';
import ImageUploader from './ImageUploader';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { toast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';

// Text to binary tensor for given pixel count
const textToTensor = (text: string, pixelCount: number): number[] => {
  let bits = '';
  for (const char of text) {
    bits += char.charCodeAt(0).toString(2).padStart(8, '0');
  }
  bits += '00000000'; // End marker
  
  const bitArray = bits.split('').map(b => parseInt(b));
  
  // Pad with zeros if needed
  const paddingNeeded = Math.max(0, pixelCount - bitArray.length);
  const paddedBits = [...bitArray, ...new Array(paddingNeeded).fill(0)];
  
  return paddedBits.slice(0, pixelCount);
};

// Binary tensor to text (matching Python implementation)
const tensorToText = (tensor: number[]): string => {
  const bits = tensor.map(v => v > 0.5 ? 1 : 0);
  let chars = '';
  
  for (let i = 0; i < bits.length; i += 8) {
    const byte = bits.slice(i, i + 8);
    if (byte.length < 8) break;
    
    const charCode = parseInt(byte.join(''), 2);
    if (charCode === 0) break; // End marker
    if (charCode >= 32 && charCode <= 126) {
      chars += String.fromCharCode(charCode);
    }
  }
  
  return chars;
};

// Simple convolution operation for encoder simulation
const applyConvolution = (data: number[], width: number, height: number, kernel: number[][]): number[] => {
  const result = new Array(data.length).fill(0);
  const kSize = kernel.length;
  const pad = Math.floor(kSize / 2);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let ky = 0; ky < kSize; ky++) {
        for (let kx = 0; kx < kSize; kx++) {
          const ny = Math.min(Math.max(y + ky - pad, 0), height - 1);
          const nx = Math.min(Math.max(x + kx - pad, 0), width - 1);
          sum += data[ny * width + nx] * kernel[ky][kx];
        }
      }
      result[y * width + x] = sum;
    }
  }
  
  return result;
};

// LSB-based encoding (similar to neural network output)
const encodeLSB = (
  coverPixels: Uint8ClampedArray,
  messageBits: number[],
  width: number,
  height: number,
  strength: number = 3
): Uint8ClampedArray => {
  const result = new Uint8ClampedArray(coverPixels);
  const pixelCount = width * height;
  
  for (let i = 0; i < Math.min(messageBits.length, pixelCount); i++) {
    const pixelIdx = i * 4;
    const bit = messageBits[i];
    
    // Embed in LSBs of RGB channels with controlled strength
    // This simulates the neural network's learned embedding
    for (let c = 0; c < 3; c++) {
      const original = result[pixelIdx + c];
      // Clear lower bits and set based on message
      const cleared = original & ~((1 << strength) - 1);
      const embedded = cleared | (bit * ((1 << strength) - 1));
      result[pixelIdx + c] = Math.max(0, Math.min(255, embedded));
    }
  }
  
  return result;
};

// LSB-based decoding (extracting hidden message)
const decodeLSB = (
  stegoPixels: Uint8ClampedArray,
  width: number,
  height: number,
  strength: number = 3
): number[] => {
  const pixelCount = width * height;
  const bits: number[] = [];
  const threshold = (1 << strength) / 2;
  
  for (let i = 0; i < pixelCount; i++) {
    const pixelIdx = i * 4;
    
    // Extract from LSBs of RGB channels and average
    let sum = 0;
    for (let c = 0; c < 3; c++) {
      const lsb = stegoPixels[pixelIdx + c] & ((1 << strength) - 1);
      sum += lsb >= threshold ? 1 : 0;
    }
    
    // Vote: if majority of channels have high LSB, bit is 1
    bits.push(sum >= 2 ? 1 : 0);
  }
  
  return bits;
};

// Neural network-inspired encoding with XOR encryption
const encodeWithKey = (
  coverPixels: Uint8ClampedArray,
  message: string,
  key: string,
  width: number,
  height: number
): Uint8ClampedArray => {
  const pixelCount = width * height;
  
  // Convert message to bits
  let messageBits = textToTensor(message, pixelCount);
  
  // XOR encrypt bits with key-derived pattern
  if (key) {
    const keyHash = key.split('').reduce((a, c) => ((a << 5) - a) + c.charCodeAt(0), 0);
    const seed = Math.abs(keyHash);
    
    let s = seed;
    const random = () => {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s / 0x7fffffff;
    };
    
    messageBits = messageBits.map((bit, i) => {
      const keyBit = random() > 0.5 ? 1 : 0;
      return bit ^ keyBit;
    });
  }
  
  return encodeLSB(coverPixels, messageBits, width, height);
};

// Neural network-inspired decoding with XOR decryption
const decodeWithKey = (
  stegoPixels: Uint8ClampedArray,
  key: string,
  width: number,
  height: number
): string => {
  let bits = decodeLSB(stegoPixels, width, height);
  
  // XOR decrypt bits with key-derived pattern
  if (key) {
    const keyHash = key.split('').reduce((a, c) => ((a << 5) - a) + c.charCodeAt(0), 0);
    const seed = Math.abs(keyHash);
    
    let s = seed;
    const random = () => {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s / 0x7fffffff;
    };
    
    bits = bits.map((bit, i) => {
      const keyBit = random() > 0.5 ? 1 : 0;
      return bit ^ keyBit;
    });
  }
  
  return tensorToText(bits);
};

const WorkspacePanel: React.FC = () => {
  // Steganography state
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [stegoImage, setStegoImage] = useState<File | null>(null);
  const [secretMessage, setSecretMessage] = useState('');
  const [encodeKey, setEncodeKey] = useState('');
  const [decodeKey, setDecodeKey] = useState('');
  const [showEncodeKey, setShowEncodeKey] = useState(false);
  const [showDecodeKey, setShowDecodeKey] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [encodedImageUrl, setEncodedImageUrl] = useState<string | null>(null);
  const [decodedMessage, setDecodedMessage] = useState<string | null>(null);
  const [encodingTime, setEncodingTime] = useState<number | null>(null);
  const [decodingTime, setDecodingTime] = useState<number | null>(null);
  const [psnrValue, setPsnrValue] = useState<number | null>(null);

  // Calculate PSNR between original and stego image
  const calculatePSNR = (original: Uint8ClampedArray, stego: Uint8ClampedArray): number => {
    let mse = 0;
    for (let i = 0; i < original.length; i++) {
      const diff = original[i] - stego[i];
      mse += diff * diff;
    }
    mse /= original.length;
    if (mse === 0) return Infinity;
    return 10 * Math.log10((255 * 255) / mse);
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

  const keyStrength = getPasswordStrength(encodeKey);

  // Calculate max message capacity
  const getMaxCapacity = (width: number, height: number): number => {
    // Each pixel can hold 1 bit, 8 bits = 1 character
    return Math.floor((width * height) / 8) - 1; // -1 for end marker
  };

  const handleEncode = useCallback(async () => {
    if (!coverImage) {
      toast({
        title: "Missing input",
        description: "Please upload a cover image.",
        variant: "destructive"
      });
      return;
    }

    if (!secretMessage.trim()) {
      toast({
        title: "Missing message",
        description: "Please enter a secret message to hide.",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    setEncodedImageUrl(null);
    setEncodingTime(null);
    setPsnrValue(null);

    const startTime = performance.now();

    try {
      const img = new Image();
      const imageUrl = URL.createObjectURL(coverImage);
      
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = imageUrl;
      });

      // Check message capacity
      const maxCapacity = getMaxCapacity(img.width, img.height);
      if (secretMessage.length > maxCapacity) {
        toast({
          title: "Message too long",
          description: `Maximum ${maxCapacity} characters for this image size. Your message has ${secretMessage.length} characters.`,
          variant: "destructive"
        });
        setIsProcessing(false);
        URL.revokeObjectURL(imageUrl);
        return;
      }

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const originalPixels = new Uint8ClampedArray(imageData.data);

      // Encode message into image
      const stegoPixels = encodeWithKey(
        imageData.data,
        secretMessage,
        encodeKey,
        canvas.width,
        canvas.height
      );

      // Calculate PSNR
      const psnr = calculatePSNR(originalPixels, stegoPixels);
      setPsnrValue(psnr);

      // Create stego image
      const newImageData = ctx.createImageData(canvas.width, canvas.height);
      newImageData.data.set(stegoPixels);
      ctx.putImageData(newImageData, 0, 0);

      const encodedUrl = canvas.toDataURL('image/png');
      setEncodedImageUrl(encodedUrl);

      const endTime = performance.now();
      setEncodingTime(Math.round(endTime - startTime));

      URL.revokeObjectURL(imageUrl);

      toast({
        title: "Encoding Complete!",
        description: `Message hidden successfully. PSNR: ${psnr.toFixed(2)} dB`,
      });
    } catch (error) {
      console.error('Encode error:', error);
      toast({
        title: "Encoding Failed",
        description: error instanceof Error ? error.message : 'An error occurred during encoding.',
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  }, [coverImage, secretMessage, encodeKey]);

  const handleDecode = useCallback(async () => {
    if (!stegoImage) {
      toast({
        title: "Missing input",
        description: "Please upload a stego image to decode.",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    setDecodedMessage(null);
    setDecodingTime(null);

    const startTime = performance.now();

    try {
      const img = new Image();
      const imageUrl = URL.createObjectURL(stegoImage);
      
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

      // Decode message from image
      const message = decodeWithKey(
        imageData.data,
        decodeKey,
        canvas.width,
        canvas.height
      );

      if (!message || message.length === 0) {
        toast({
          title: "No message found",
          description: "Could not extract a message. Check if the image contains hidden data or if the key is correct.",
          variant: "destructive"
        });
        setIsProcessing(false);
        URL.revokeObjectURL(imageUrl);
        return;
      }

      setDecodedMessage(message);

      const endTime = performance.now();
      setDecodingTime(Math.round(endTime - startTime));

      URL.revokeObjectURL(imageUrl);

      toast({
        title: "Decoding Complete!",
        description: `Message extracted successfully!`,
      });
    } catch (error) {
      console.error('Decode error:', error);
      toast({
        title: "Decoding Failed",
        description: error instanceof Error ? error.message : 'An error occurred during decoding.',
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  }, [stegoImage, decodeKey]);

  const handleDownload = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Tabs defaultValue="encode" className="w-full">
      <TabsList className="grid w-full grid-cols-2 mb-4">
        <TabsTrigger value="encode" className="flex items-center gap-2">
          <Lock className="w-4 h-4" />
          Encode
        </TabsTrigger>
        <TabsTrigger value="decode" className="flex items-center gap-2">
          <Unlock className="w-4 h-4" />
          Decode
        </TabsTrigger>
      </TabsList>

      {/* Encode Tab */}
      <TabsContent value="encode">
        <GlassCard className="transition-all duration-300">
          <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
            <div className="p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-primary/10 border border-primary/20">
              <Lock className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
            </div>
            <div>
              <h2 className="font-mono font-bold text-lg sm:text-xl text-foreground">Hide Message</h2>
              <p className="text-xs sm:text-sm text-muted-foreground">Embed secret message in image using neural steganography</p>
            </div>
          </div>
          
          <div className="space-y-4 sm:space-y-5">
            <ImageUploader 
              label="Cover Image" 
              onImageSelect={setCoverImage}
            />
            
            <div>
              <label className="text-xs sm:text-sm font-medium text-muted-foreground mb-2 block flex items-center gap-2">
                <MessageSquare className="w-3 h-3 sm:w-4 sm:h-4" />
                Secret Message
              </label>
              <Textarea
                placeholder="Enter your secret message to hide..."
                value={secretMessage}
                onChange={(e) => setSecretMessage(e.target.value)}
                className="bg-muted/30 border-border/50 focus:border-primary/50 focus:ring-primary/20 font-mono text-xs sm:text-sm min-h-[80px]"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {secretMessage.length} characters
              </p>
            </div>
            
            <div>
              <label className="text-xs sm:text-sm font-medium text-muted-foreground mb-2 block flex items-center gap-2">
                <Key className="w-3 h-3 sm:w-4 sm:h-4" />
                Encryption Key (Optional)
              </label>
              <div className="relative">
                <Input
                  type={showEncodeKey ? "text" : "password"}
                  placeholder="Enter encryption key..."
                  value={encodeKey}
                  onChange={(e) => setEncodeKey(e.target.value)}
                  className="bg-muted/30 border-border/50 focus:border-primary/50 focus:ring-primary/20 font-mono text-xs sm:text-sm pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowEncodeKey(!showEncodeKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showEncodeKey ? <EyeOff className="w-3 h-3 sm:w-4 sm:h-4" /> : <Eye className="w-3 h-3 sm:w-4 sm:h-4" />}
                </button>
              </div>
              {encodeKey && (
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
              onClick={handleEncode}
              disabled={isProcessing || !coverImage || !secretMessage.trim()}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                  <span className="ml-2">Encoding...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="ml-2">Hide Message</span>
                </>
              )}
            </Button>

            {/* Encoded Image Result */}
            {encodedImageUrl && (
              <div className="p-3 sm:p-4 rounded-lg sm:rounded-xl bg-primary/10 border border-primary/20 animate-fade-in space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Lock className="w-3 h-3 sm:w-4 sm:h-4 text-primary" />
                    <span className="text-xs sm:text-sm font-medium text-primary">Stego Image</span>
                    {encodingTime && (
                      <span className="text-xs text-muted-foreground">({encodingTime}ms)</span>
                    )}
                    {psnrValue && (
                      <span className="text-xs text-muted-foreground">PSNR: {psnrValue.toFixed(2)} dB</span>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownload(encodedImageUrl, `stego_${Date.now()}.png`)}
                    className="text-xs"
                  >
                    <Download className="w-3 h-3 mr-1" />
                    Download
                  </Button>
                </div>
                <img 
                  src={encodedImageUrl} 
                  alt="Stego image" 
                  className="w-full h-32 sm:h-40 object-contain rounded-lg border border-border/50 bg-muted/20"
                />
              </div>
            )}
          </div>
        </GlassCard>
      </TabsContent>

      {/* Decode Tab */}
      <TabsContent value="decode">
        <GlassCard className="transition-all duration-300">
          <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
            <div className="p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-secondary/10 border border-secondary/20">
              <Unlock className="w-5 h-5 sm:w-6 sm:h-6 text-secondary" />
            </div>
            <div>
              <h2 className="font-mono font-bold text-lg sm:text-xl text-foreground">Reveal Message</h2>
              <p className="text-xs sm:text-sm text-muted-foreground">Extract hidden message from stego image</p>
            </div>
          </div>
          
          <div className="space-y-4 sm:space-y-5">
            <ImageUploader 
              label="Stego Image" 
              onImageSelect={setStegoImage}
            />
            
            <div>
              <label className="text-xs sm:text-sm font-medium text-muted-foreground mb-2 block flex items-center gap-2">
                <Key className="w-3 h-3 sm:w-4 sm:h-4" />
                Decryption Key (if used during encoding)
              </label>
              <div className="relative">
                <Input
                  type={showDecodeKey ? "text" : "password"}
                  placeholder="Enter decryption key..."
                  value={decodeKey}
                  onChange={(e) => setDecodeKey(e.target.value)}
                  className="bg-muted/30 border-border/50 focus:border-secondary/50 focus:ring-secondary/20 font-mono text-xs sm:text-sm pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowDecodeKey(!showDecodeKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showDecodeKey ? <EyeOff className="w-3 h-3 sm:w-4 sm:h-4" /> : <Eye className="w-3 h-3 sm:w-4 sm:h-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-1 sm:mt-2">
                Leave empty if no key was used during encoding
              </p>
            </div>
            
            <Button 
              variant="secondary" 
              size="lg" 
              className="w-full text-sm sm:text-base"
              onClick={handleDecode}
              disabled={isProcessing || !stegoImage}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                  <span className="ml-2">Decoding...</span>
                </>
              ) : (
                <>
                  <ImageIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="ml-2">Reveal Message</span>
                </>
              )}
            </Button>
            
            {/* Decoded Message Result */}
            {decodedMessage && (
              <div className="p-3 sm:p-4 rounded-lg sm:rounded-xl bg-secondary/10 border border-secondary/20 animate-fade-in space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-3 h-3 sm:w-4 sm:h-4 text-secondary" />
                    <span className="text-xs sm:text-sm font-medium text-secondary">Hidden Message</span>
                    {decodingTime && (
                      <span className="text-xs text-muted-foreground">({decodingTime}ms)</span>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(decodedMessage);
                      toast({ title: "Copied!", description: "Message copied to clipboard" });
                    }}
                    className="text-xs"
                  >
                    Copy
                  </Button>
                </div>
                <div className="p-3 bg-muted/30 rounded-lg border border-border/50">
                  <p className="text-sm font-mono text-foreground whitespace-pre-wrap break-words">
                    {decodedMessage}
                  </p>
                </div>
              </div>
            )}
          </div>
        </GlassCard>
      </TabsContent>
    </Tabs>
  );
};

export default WorkspacePanel;
