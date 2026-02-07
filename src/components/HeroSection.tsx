import React from 'react';
import { Cpu, Eye, Shield } from 'lucide-react';
import logo from '@/assets/logo.png';

const HeroSection: React.FC = () => {
  return (
    <div className="text-center mb-8 sm:mb-12 px-2">
      {/* Logo/Icon */}
      <div className="inline-flex items-center justify-center mb-4 sm:mb-6 relative">
        <div className="absolute inset-0 w-20 h-20 sm:w-28 sm:h-28 rounded-2xl bg-primary/20 blur-xl animate-pulse-glow" />
        <div className="relative w-20 h-20 sm:w-28 sm:h-28 rounded-xl sm:rounded-2xl overflow-hidden">
          <img src={logo} alt="StegAI Logo" className="w-full h-full object-contain" />
        </div>
      </div>
      
      {/* Title */}
      <h1 className="font-mono text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-3 sm:mb-4 tracking-tight">
        <span className="cyber-text">StegAI</span>
        <span className="text-foreground block sm:inline">: Enhanced Data Security</span>
      </h1>
      
      {/* Subtitle */}
      <p className="text-sm sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-6 sm:mb-8 leading-relaxed px-2">
        Hide secret data inside images using advanced Neural Networks. 
        Imperceptible to the human eye, secure against detection.
      </p>
      
      {/* Features Pills */}
      <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
        <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-full bg-muted/50 border border-border/50">
          <Cpu className="w-3 h-3 sm:w-4 sm:h-4 text-primary" />
          <span className="text-xs sm:text-sm font-medium">Deep Learning</span>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-full bg-muted/50 border border-border/50">
          <Eye className="w-3 h-3 sm:w-4 sm:h-4 text-secondary" />
          <span className="text-xs sm:text-sm font-medium">Undetectable</span>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-full bg-muted/50 border border-border/50">
          <Shield className="w-3 h-3 sm:w-4 sm:h-4 text-cyber-green" />
          <span className="text-xs sm:text-sm font-medium">Military-Grade</span>
        </div>
      </div>
      
      {/* Decorative Line */}
      <div className="mt-6 sm:mt-10 neon-line max-w-xs sm:max-w-md mx-auto" />
    </div>
  );
};

export default HeroSection;
