import React, { useState } from 'react';
import { Lock, Unlock, Shield, Loader2, Sparkles, Key, Eye, EyeOff, Download } from 'lucide-react';
import GlassCard from './GlassCard';
import ImageUploader from './ImageUploader';
import ImageHistogram from './ImageHistogram';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Input } from './ui/input';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

type Mode = 'encode' | 'decode';

interface EncodingMetrics {
  psnrValue: number;
  ssimScore: number;
  encodingTimeMs: number;
}

const WorkspacePanel: React.FC = () => {
  const [mode, setMode] = useState<Mode>('encode');
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [secretMessage, setSecretMessage] = useState('');
  const [encryptionKey, setEncryptionKey] = useState('');
  const [decryptionKey, setDecryptionKey] = useState('');
  const [showEncryptionKey, setShowEncryptionKey] = useState(false);
  const [showDecryptionKey, setShowDecryptionKey] = useState(false);
  const [stegoImage, setStegoImage] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [revealedMessage, setRevealedMessage] = useState<string | null>(null);
  const [generatedStegoUrl, setGeneratedStegoUrl] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<EncodingMetrics | null>(null);

  const getPasswordStrength = (password: string): { score: number; label: string; color: string } => {
    if (!password) return { score: 0, label: '', color: '' };
    
    let score = 0;
    
    // Length checks
    if (password.length >= 8) score += 1;
    if (password.length >= 12) score += 1;
    if (password.length >= 16) score += 1;
    
    // Character variety checks
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

  const handleEncode = async () => {
    if (!coverImage || !secretMessage) {
      toast({
        title: "Missing inputs",
        description: "Please upload a cover image and enter a secret message.",
        variant: "destructive"
      });
      return;
    }

    // Check if user is authenticated
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast({
        title: "Authentication required",
        description: "Please sign in to encode messages.",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    setGeneratedStegoUrl(null);
    setMetrics(null);

    try {
      const formData = new FormData();
      formData.append('image', coverImage);
      formData.append('message', secretMessage);
      if (encryptionKey) {
        formData.append('encryptionKey', encryptionKey);
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/steganography-encode`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: formData,
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Encoding failed');
      }

      setGeneratedStegoUrl(result.stegoImageUrl);
      setMetrics(result.metrics);
      
      toast({
        title: "Encoding Complete!",
        description: `Stego-image generated in ${result.metrics.encodingTimeMs}ms. PSNR: ${result.metrics.psnrValue}dB`,
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
  };

  const handleDecode = async () => {
    if (!stegoImage) {
      toast({
        title: "Missing input",
        description: "Please upload an encrypted image to decode.",
        variant: "destructive"
      });
      return;
    }

    // Check if user is authenticated
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast({
        title: "Authentication required",
        description: "Please sign in to decode messages.",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    setRevealedMessage(null);

    try {
      const formData = new FormData();
      formData.append('image', stegoImage);
      if (decryptionKey) {
        formData.append('decryptionKey', decryptionKey);
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/steganography-decode`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: formData,
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Decoding failed');
      }

      setRevealedMessage(result.message);
      
      toast({
        title: "Decoding Complete!",
        description: `Hidden message revealed in ${result.decodingTimeMs}ms.`,
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
  };

  const handleDownloadStego = () => {
    if (generatedStegoUrl) {
      const link = document.createElement('a');
      link.href = generatedStegoUrl;
      link.download = `stego_image_${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
      {/* Encoder Panel */}
      <GlassCard className={`transition-all duration-300 ${mode === 'encode' ? 'ring-2 ring-primary/50' : ''}`}>
        <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
          <div className="p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-primary/10 border border-primary/20">
            <Lock className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
          </div>
          <div>
            <h2 className="font-mono font-bold text-lg sm:text-xl text-foreground">Encoder</h2>
            <p className="text-xs sm:text-sm text-muted-foreground">Hide secret data in images</p>
          </div>
        </div>
        
        <div className="space-y-4 sm:space-y-5">
          <ImageUploader 
            label="Cover Image" 
            onImageSelect={setCoverImage}
          />
          
          <ImageHistogram imageFile={coverImage} label="Cover Image Histogram" />
          
          <div>
            <label className="text-xs sm:text-sm font-medium text-muted-foreground mb-2 block">
              Secret Message
            </label>
            <Textarea
              placeholder="Enter your secret message to hide..."
              value={secretMessage}
              onChange={(e) => setSecretMessage(e.target.value)}
              className="min-h-[80px] sm:min-h-[100px] bg-muted/30 border-border/50 focus:border-primary/50 focus:ring-primary/20 resize-none font-mono text-xs sm:text-sm"
            />
            <p className="text-xs text-muted-foreground mt-1 sm:mt-2">
              {secretMessage.length} characters
            </p>
          </div>
          
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
            {!encryptionKey && (
              <p className="text-xs text-muted-foreground mt-2">
                Optional: Add a key to encrypt your message before hiding
              </p>
            )}
          </div>
          
          <Button 
            variant="cyber" 
            size="lg" 
            className="w-full text-sm sm:text-base"
            onClick={handleEncode}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                <span className="ml-2">Processing...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="ml-2">Generate Stego-Image</span>
              </>
            )}
          </Button>

          {/* Generated Stego Image Result */}
          {generatedStegoUrl && (
            <div className="p-3 sm:p-4 rounded-lg sm:rounded-xl bg-primary/10 border border-primary/20 animate-fade-in space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Lock className="w-3 h-3 sm:w-4 sm:h-4 text-primary" />
                  <span className="text-xs sm:text-sm font-medium text-primary">Stego-Image Generated</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadStego}
                  className="text-xs"
                >
                  <Download className="w-3 h-3 mr-1" />
                  Download
                </Button>
              </div>
              <img 
                src={generatedStegoUrl} 
                alt="Generated stego image" 
                className="w-full h-32 sm:h-40 object-cover rounded-lg border border-border/50"
              />
              {metrics && (
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 rounded-lg bg-background/50">
                    <p className="text-xs text-muted-foreground">PSNR</p>
                    <p className="text-sm font-mono font-bold text-primary">{metrics.psnrValue} dB</p>
                  </div>
                  <div className="p-2 rounded-lg bg-background/50">
                    <p className="text-xs text-muted-foreground">SSIM</p>
                    <p className="text-sm font-mono font-bold text-primary">{metrics.ssimScore}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-background/50">
                    <p className="text-xs text-muted-foreground">Time</p>
                    <p className="text-sm font-mono font-bold text-primary">{metrics.encodingTimeMs}ms</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </GlassCard>

      {/* Decoder Panel */}
      <GlassCard className={`transition-all duration-300 ${mode === 'decode' ? 'ring-2 ring-secondary/50' : ''}`}>
        <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
          <div className="p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-secondary/10 border border-secondary/20">
            <Unlock className="w-5 h-5 sm:w-6 sm:h-6 text-secondary" />
          </div>
          <div>
            <h2 className="font-mono font-bold text-lg sm:text-xl text-foreground">Decoder</h2>
            <p className="text-xs sm:text-sm text-muted-foreground">Reveal hidden content</p>
          </div>
        </div>
        
        <div className="space-y-4 sm:space-y-5">
          <ImageUploader 
            label="Encrypted Image" 
            onImageSelect={setStegoImage}
          />
          
          <ImageHistogram imageFile={stegoImage} label="Stego Image Histogram" />
          
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
              Enter the key used during encryption
            </p>
          </div>
          
          <Button 
            variant="secondary" 
            size="lg" 
            className="w-full text-sm sm:text-base"
            onClick={handleDecode}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                <span className="ml-2">Decoding...</span>
              </>
            ) : (
              <>
                <Shield className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="ml-2">Reveal Secret</span>
              </>
            )}
          </Button>
          
          {revealedMessage && (
            <div className="p-3 sm:p-4 rounded-lg sm:rounded-xl bg-secondary/10 border border-secondary/20 animate-fade-in">
              <div className="flex items-center gap-2 mb-2">
                <Unlock className="w-3 h-3 sm:w-4 sm:h-4 text-secondary" />
                <span className="text-xs sm:text-sm font-medium text-secondary">Revealed Message</span>
              </div>
              <p className="text-foreground font-mono text-xs sm:text-sm leading-relaxed">
                {revealedMessage}
              </p>
            </div>
          )}
        </div>
      </GlassCard>
    </div>
  );
};

export default WorkspacePanel;
