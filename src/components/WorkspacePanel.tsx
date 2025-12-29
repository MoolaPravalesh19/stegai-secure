import React, { useState } from 'react';
import { Lock, Unlock, Shield, Loader2, Sparkles } from 'lucide-react';
import GlassCard from './GlassCard';
import ImageUploader from './ImageUploader';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { toast } from '@/hooks/use-toast';

type Mode = 'encode' | 'decode';

const WorkspacePanel: React.FC = () => {
  const [mode, setMode] = useState<Mode>('encode');
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [secretMessage, setSecretMessage] = useState('');
  const [stegoImage, setStegoImage] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [revealedMessage, setRevealedMessage] = useState<string | null>(null);

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
              className="min-h-[120px] bg-muted/30 border-border/50 focus:border-primary/50 focus:ring-primary/20 resize-none font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground mt-2">
              {secretMessage.length} characters
            </p>
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
