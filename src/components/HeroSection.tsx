import React from 'react';
import { Shield, Cpu, Eye } from 'lucide-react';

const HeroSection: React.FC = () => {
  return (
    <div className="text-center mb-12">
      {/* Logo/Icon */}
      <div className="inline-flex items-center justify-center mb-6 relative">
        <div className="absolute inset-0 w-20 h-20 rounded-2xl bg-primary/20 blur-xl animate-pulse-glow" />
        <div className="relative p-4 rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 border border-primary/30">
          <Shield className="w-12 h-12 text-primary" />
        </div>
      </div>
      
      {/* Title */}
      <h1 className="font-mono text-4xl md:text-5xl lg:text-6xl font-bold mb-4 tracking-tight">
        <span className="cyber-text">StegAI</span>
        <span className="text-foreground">: Enhanced Data Security</span>
      </h1>
      
      {/* Subtitle */}
      <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8 leading-relaxed">
        Hide secret data inside images using advanced Neural Networks. 
        Imperceptible to the human eye, secure against detection.
      </p>
      
      {/* Features Pills */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-muted/50 border border-border/50">
          <Cpu className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">Deep Learning Powered</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-muted/50 border border-border/50">
          <Eye className="w-4 h-4 text-secondary" />
          <span className="text-sm font-medium">Undetectable Embedding</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-muted/50 border border-border/50">
          <Shield className="w-4 h-4 text-cyber-green" />
          <span className="text-sm font-medium">Military-Grade Security</span>
        </div>
      </div>
      
      {/* Decorative Line */}
      <div className="mt-10 neon-line max-w-md mx-auto" />
    </div>
  );
};

export default HeroSection;
