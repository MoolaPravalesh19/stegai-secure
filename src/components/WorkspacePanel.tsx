import React, { useState } from 'react';
import { Lock, Unlock, Shield, Loader2, Sparkles, Key, Eye, EyeOff } from 'lucide-react';
import GlassCard from './GlassCard';
import ImageUploader from './ImageUploader';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Input } from './ui/input';
import { toast } from '@/hooks/use-toast';

type Mode = 'encode' | 'decode';

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

    setIsProcessing(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000));
    setIsProcessing(false);
    
    toast({
      title: "Encoding Complete!",
      description: "Your stego-image has been generated successfully.",
    });
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

    setIsProcessing(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    setRevealedMessage("This is the hidden secret message that was encoded in the image using neural network-based steganography.");
    setIsProcessing(false);
    
    toast({
      title: "Decoding Complete!",
      description: "Hidden message has been revealed.",
    });
  };

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      {/* Encoder Panel */}
      <GlassCard className={`transition-all duration-300 ${mode === 'encode' ? 'ring-2 ring-primary/50' : ''}`}>
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20">
            <Lock className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="font-mono font-bold text-xl text-foreground">Encoder</h2>
            <p className="text-sm text-muted-foreground">Hide secret data in images</p>
          </div>
        </div>
        
        <div className="space-y-5">
          <ImageUploader 
            label="Cover Image" 
            onImageSelect={setCoverImage}
          />
          
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-2 block">
              Secret Message
            </label>
            <Textarea
              placeholder="Enter your secret message to hide..."
              value={secretMessage}
              onChange={(e) => setSecretMessage(e.target.value)}
              className="min-h-[100px] bg-muted/30 border-border/50 focus:border-primary/50 focus:ring-primary/20 resize-none font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground mt-2">
              {secretMessage.length} characters
            </p>
          </div>
          
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-2 block flex items-center gap-2">
              <Key className="w-4 h-4" />
              Encryption Key
            </label>
            <div className="relative">
              <Input
                type={showEncryptionKey ? "text" : "password"}
                placeholder="Enter encryption key for added security..."
                value={encryptionKey}
                onChange={(e) => setEncryptionKey(e.target.value)}
                className="bg-muted/30 border-border/50 focus:border-primary/50 focus:ring-primary/20 font-mono text-sm pr-10"
              />
              <button
                type="button"
                onClick={() => setShowEncryptionKey(!showEncryptionKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showEncryptionKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
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
            className="w-full"
            onClick={handleEncode}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                Generate Stego-Image
              </>
            )}
          </Button>
        </div>
      </GlassCard>

      {/* Decoder Panel */}
      <GlassCard className={`transition-all duration-300 ${mode === 'decode' ? 'ring-2 ring-secondary/50' : ''}`}>
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 rounded-xl bg-secondary/10 border border-secondary/20">
            <Unlock className="w-6 h-6 text-secondary" />
          </div>
          <div>
            <h2 className="font-mono font-bold text-xl text-foreground">Decoder</h2>
            <p className="text-sm text-muted-foreground">Reveal hidden content</p>
          </div>
        </div>
        
        <div className="space-y-5">
          <ImageUploader 
            label="Encrypted Image" 
            onImageSelect={setStegoImage}
          />
          
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-2 block flex items-center gap-2">
              <Key className="w-4 h-4" />
              Decryption Key
            </label>
            <div className="relative">
              <Input
                type={showDecryptionKey ? "text" : "password"}
                placeholder="Enter decryption key..."
                value={decryptionKey}
                onChange={(e) => setDecryptionKey(e.target.value)}
                className="bg-muted/30 border-border/50 focus:border-secondary/50 focus:ring-secondary/20 font-mono text-sm pr-10"
              />
              <button
                type="button"
                onClick={() => setShowDecryptionKey(!showDecryptionKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showDecryptionKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Enter the key used during encryption
            </p>
          </div>
          
          <Button 
            variant="secondary" 
            size="lg" 
            className="w-full"
            onClick={handleDecode}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Decoding...
              </>
            ) : (
              <>
                <Shield className="w-5 h-5" />
                Reveal Secret
              </>
            )}
          </Button>
          
          {revealedMessage && (
            <div className="p-4 rounded-xl bg-secondary/10 border border-secondary/20 animate-fade-in">
              <div className="flex items-center gap-2 mb-2">
                <Unlock className="w-4 h-4 text-secondary" />
                <span className="text-sm font-medium text-secondary">Revealed Message</span>
              </div>
              <p className="text-foreground font-mono text-sm leading-relaxed">
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
