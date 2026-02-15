import React, { useState, useCallback } from 'react';
import { Lock, Unlock, Loader2, Sparkles, Key, Eye, EyeOff, Download, ImageIcon, MessageSquare, Brain, Zap } from 'lucide-react';
import GlassCard from './GlassCard';
import ImageUploader from './ImageUploader';
import ModelUploader from './ModelUploader';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { toast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { 
  areModelsLoaded, 
  encodeWithNeuralNet, 
  decodeWithNeuralNet,
  textToTensor,
  tensorToText
} from '@/lib/onnxModel';
import { supabase } from '@/integrations/supabase/client';

// LSB-based encoding (fallback when neural model not loaded)
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
    
    for (let c = 0; c < 3; c++) {
      const original = result[pixelIdx + c];
      const cleared = original & ~((1 << strength) - 1);
      const embedded = cleared | (bit * ((1 << strength) - 1));
      result[pixelIdx + c] = Math.max(0, Math.min(255, embedded));
    }
  }
  
  return result;
};

// LSB-based decoding
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
    let sum = 0;
    for (let c = 0; c < 3; c++) {
      const lsb = stegoPixels[pixelIdx + c] & ((1 << strength) - 1);
      sum += lsb >= threshold ? 1 : 0;
    }
    bits.push(sum >= 2 ? 1 : 0);
  }
  
  return bits;
};

// Text to bits for LSB
const textToBits = (text: string, pixelCount: number): number[] => {
  let bits = '';
  for (const char of text) {
    bits += char.charCodeAt(0).toString(2).padStart(8, '0');
  }
  bits += '00000000';
  
  const bitArray = bits.split('').map(b => parseInt(b));
  const paddingNeeded = Math.max(0, pixelCount - bitArray.length);
  const paddedBits = [...bitArray, ...new Array(paddingNeeded).fill(0)];
  
  return paddedBits.slice(0, pixelCount);
};

// Bits to text for LSB
const bitsToText = (bits: number[]): string => {
  const binaryBits = bits.map(v => v > 0.5 ? 1 : 0);
  let chars = '';
  
  for (let i = 0; i < binaryBits.length; i += 8) {
    const byte = binaryBits.slice(i, i + 8);
    if (byte.length < 8) break;
    
    const charCode = parseInt(byte.join(''), 2);
    if (charCode === 0) break;
    if (charCode >= 32 && charCode <= 126) {
      chars += String.fromCharCode(charCode);
    }
  }
  
  return chars;
};

// XOR encryption with key
const encodeWithKey = (
  coverPixels: Uint8ClampedArray,
  message: string,
  key: string,
  width: number,
  height: number
): Uint8ClampedArray => {
  const pixelCount = width * height;
  let messageBits = textToBits(message, pixelCount);
  
  if (key) {
    const keyHash = key.split('').reduce((a, c) => ((a << 5) - a) + c.charCodeAt(0), 0);
    const seed = Math.abs(keyHash);
    
    let s = seed;
    const random = () => {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s / 0x7fffffff;
    };
    
    messageBits = messageBits.map((bit) => {
      const keyBit = random() > 0.5 ? 1 : 0;
      return bit ^ keyBit;
    });
  }
  
  return encodeLSB(coverPixels, messageBits, width, height);
};

// XOR decryption with key
const decodeWithKey = (
  stegoPixels: Uint8ClampedArray,
  key: string,
  width: number,
  height: number
): string => {
  let bits = decodeLSB(stegoPixels, width, height);
  
  if (key) {
    const keyHash = key.split('').reduce((a, c) => ((a << 5) - a) + c.charCodeAt(0), 0);
    const seed = Math.abs(keyHash);
    
    let s = seed;
    const random = () => {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s / 0x7fffffff;
    };
    
    bits = bits.map((bit) => {
      const keyBit = random() > 0.5 ? 1 : 0;
      return bit ^ keyBit;
    });
  }
  
  return bitsToText(bits);
};

const WorkspacePanel: React.FC = () => {
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
  const [useNeuralNet, setUseNeuralNet] = useState(false);
  const [modelsReady, setModelsReady] = useState(areModelsLoaded());

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
    if (score <= 4) return { score: 2, label: 'Medium', color: 'bg-warning' };
    if (score <= 5) return { score: 3, label: 'Strong', color: 'bg-success' };
    return { score: 4, label: 'Very Strong', color: 'bg-success' };
  };

  const keyStrength = getPasswordStrength(encodeKey);

  const getMaxCapacity = (width: number, height: number): number => {
    return Math.floor((width * height) / 8) - 1;
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

      const maxCapacity = getMaxCapacity(img.width, img.height);
      if (secretMessage.length > maxCapacity) {
        toast({
          title: "Message too long",
          description: `Maximum ${maxCapacity} characters. Your message has ${secretMessage.length}.`,
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

      let stegoImageData: ImageData;
      let psnr: number;

      if (useNeuralNet && modelsReady) {
        // Use Neural Network
        const result = await encodeWithNeuralNet(imageData, secretMessage);
        stegoImageData = result.stegoImageData;
        psnr = result.psnr;
      } else {
        // Use LSB method
        const stegoPixels = encodeWithKey(
          imageData.data,
          secretMessage,
          encodeKey,
          canvas.width,
          canvas.height
        );
        
        stegoImageData = ctx.createImageData(canvas.width, canvas.height);
        stegoImageData.data.set(stegoPixels);
        psnr = calculatePSNR(originalPixels, stegoPixels);
      }

      setPsnrValue(psnr);

      const newCanvas = document.createElement('canvas');
      const newCtx = newCanvas.getContext('2d')!;
      newCanvas.width = stegoImageData.width;
      newCanvas.height = stegoImageData.height;
      newCtx.putImageData(stegoImageData, 0, 0);

      const encodedUrl = newCanvas.toDataURL('image/png');
      setEncodedImageUrl(encodedUrl);

      const endTime = performance.now();
      setEncodingTime(Math.round(endTime - startTime));

      URL.revokeObjectURL(imageUrl);

      // Save to history
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        let coverImageUrl: string | null = null;
        let stegoImageUrl: string | null = null;

        // Upload cover image to storage
        try {
          const coverPath = `${user.id}/${Date.now()}_cover_${coverImage.name}`;
          const { error: coverUpErr } = await supabase.storage
            .from('stego-images')
            .upload(coverPath, coverImage, { contentType: coverImage.type });
          if (!coverUpErr) {
            const { data: coverUrlData } = supabase.storage
              .from('stego-images')
              .getPublicUrl(coverPath);
            coverImageUrl = coverUrlData.publicUrl;
          }
        } catch (e) { console.error('Cover upload failed:', e); }

        // Upload stego image to storage
        try {
          const stegoBlob = await (await fetch(encodedUrl)).blob();
          const stegoPath = `${user.id}/${Date.now()}_stego_${coverImage.name}`;
          const { error: stegoUpErr } = await supabase.storage
            .from('stego-images')
            .upload(stegoPath, stegoBlob, { contentType: 'image/png' });
          if (!stegoUpErr) {
            const { data: stegoUrlData } = supabase.storage
              .from('stego-images')
              .getPublicUrl(stegoPath);
            stegoImageUrl = stegoUrlData.publicUrl;
          }
        } catch (e) { console.error('Stego upload failed:', e); }

        await supabase.from('encryption_history').insert({
          user_id: user.id,
          operation_type: 'encode',
          status: 'success',
          filename: coverImage.name,
          encoding_time_ms: Math.round(endTime - startTime),
          psnr_value: psnr,
          message: secretMessage,
          cover_image_url: coverImageUrl,
          stego_image_url: stegoImageUrl,
        });
      }

      toast({
        title: "Encoding Complete! 🎉",
        description: `Message hidden using ${useNeuralNet && modelsReady ? 'Neural Network' : 'LSB'}. PSNR: ${psnr.toFixed(2)} dB`,
      });
    } catch (error) {
      console.error('Encode error:', error);
      
      // Save error to history
      const { data: { user } } = await supabase.auth.getUser();
      if (user && coverImage) {
        await supabase.from('encryption_history').insert({
          user_id: user.id,
          operation_type: 'encode',
          status: 'error',
          filename: coverImage.name,
          encryption_method: useNeuralNet && modelsReady ? 'Neural' : 'LSB',
          key_used: !useNeuralNet && encodeKey.length > 0,
          file_size_bytes: coverImage.size,
          image_format: coverImage.name.split('.').pop()?.toUpperCase() || 'PNG'
        });
      }
      
      toast({
        title: "Encoding Failed",
        description: error instanceof Error ? error.message : 'An error occurred.',
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  }, [coverImage, secretMessage, encodeKey, useNeuralNet, modelsReady]);

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

      let message: string;

      if (useNeuralNet && modelsReady) {
        // Use Neural Network
        message = await decodeWithNeuralNet(imageData);
      } else {
        // Use LSB method
        message = decodeWithKey(
          imageData.data,
          decodeKey,
          canvas.width,
          canvas.height
        );
      }

      if (!message || message.length === 0) {
        toast({
          title: "No message found",
          description: "Could not extract a message. Check image or key.",
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

      // Save to history
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        let stegoImageUrl: string | null = null;

        // Upload stego image to storage
        try {
          const stegoPath = `${user.id}/${Date.now()}_decode_${stegoImage.name}`;
          const { error: stegoUpErr } = await supabase.storage
            .from('stego-images')
            .upload(stegoPath, stegoImage, { contentType: stegoImage.type });
          if (!stegoUpErr) {
            const { data: stegoUrlData } = supabase.storage
              .from('stego-images')
              .getPublicUrl(stegoPath);
            stegoImageUrl = stegoUrlData.publicUrl;
          }
        } catch (e) { console.error('Stego upload failed:', e); }

        await supabase.from('encryption_history').insert({
          user_id: user.id,
          operation_type: 'decode',
          status: 'success',
          filename: stegoImage.name,
          encoding_time_ms: Math.round(endTime - startTime),
          message: message,
          stego_image_url: stegoImageUrl,
        });
      }

      toast({
        title: "Decoding Complete! 🎉",
        description: `Message extracted using ${useNeuralNet && modelsReady ? 'Neural Network' : 'LSB'}!`,
      });
    } catch (error) {
      console.error('Decode error:', error);
      
      // Save error to history
      const { data: { user } } = await supabase.auth.getUser();
      if (user && stegoImage) {
        await supabase.from('encryption_history').insert({
          user_id: user.id,
          operation_type: 'decode',
          status: 'error',
          filename: stegoImage.name,
          encryption_method: useNeuralNet && modelsReady ? 'Neural' : 'LSB',
          key_used: !useNeuralNet && decodeKey.length > 0,
          file_size_bytes: stegoImage.size,
          image_format: stegoImage.name.split('.').pop()?.toUpperCase() || 'PNG'
        });
      }
      
      toast({
        title: "Decoding Failed",
        description: error instanceof Error ? error.message : 'An error occurred.',
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  }, [stegoImage, decodeKey, useNeuralNet, modelsReady]);

  const handleDownload = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      {/* Model Uploader */}
      <ModelUploader onModelsLoaded={() => setModelsReady(true)} />
      
      {/* Method Toggle */}
      <div className="flex items-center justify-center gap-2 p-3 rounded-lg bg-muted/30 border border-border/50">
        <Button
          variant={!useNeuralNet ? "cyber" : "outline"}
          size="sm"
          onClick={() => setUseNeuralNet(false)}
          className="flex items-center gap-2"
        >
          <Zap className="w-4 h-4" />
          LSB Method
        </Button>
        <Button
          variant={useNeuralNet ? "cyber" : "outline"}
          size="sm"
          onClick={() => setUseNeuralNet(true)}
          disabled={!modelsReady}
          className="flex items-center gap-2"
        >
          <Brain className="w-4 h-4" />
          Neural Network
        </Button>
      </div>

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
                <p className="text-xs sm:text-sm text-muted-foreground">
                  {useNeuralNet && modelsReady ? 'Using Neural Network (CNN)' : 'Using LSB Steganography'}
                </p>
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
              
              {!useNeuralNet && (
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
                        keyStrength.score === 2 ? 'text-warning' :
                        'text-success'
                      }`}>
                        {keyStrength.label}
                      </p>
                    </div>
                  )}
                </div>
              )}
              
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
                <p className="text-xs sm:text-sm text-muted-foreground">
                  {useNeuralNet && modelsReady ? 'Using Neural Network (CNN)' : 'Using LSB Steganography'}
                </p>
              </div>
            </div>
            
            <div className="space-y-4 sm:space-y-5">
              <ImageUploader 
                label="Stego Image" 
                onImageSelect={setStegoImage}
              />
              
              {!useNeuralNet && (
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
                    Leave empty if no key was used
                  </p>
                </div>
              )}
              
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
    </div>
  );
};

export default WorkspacePanel;
