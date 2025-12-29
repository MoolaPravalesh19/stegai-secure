import React from 'react';

const CyberGrid: React.FC = () => {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      {/* Dark background */}
      <div className="absolute inset-0 bg-background" />
      
      {/* Animated grid pattern */}
      <div 
        className="absolute inset-0 bg-cyber-grid bg-grid-size animate-grid-flow opacity-60"
      />
      
      {/* Radial gradient overlay */}
      <div 
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at 50% 0%, hsl(var(--primary) / 0.08) 0%, transparent 50%)',
        }}
      />
      
      {/* Bottom gradient */}
      <div 
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at 50% 100%, hsl(var(--secondary) / 0.06) 0%, transparent 50%)',
        }}
      />
      
      {/* Floating orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-primary/5 blur-3xl animate-float" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-secondary/5 blur-3xl animate-float" style={{ animationDelay: '-3s' }} />
      
      {/* Scan lines effect */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-[0.02]"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, hsl(var(--foreground)) 2px, hsl(var(--foreground)) 4px)',
        }}
      />
    </div>
  );
};

export default CyberGrid;
