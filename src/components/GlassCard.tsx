import React from 'react';
import { cn } from '@/lib/utils';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  glow?: boolean;
}

const GlassCard: React.FC<GlassCardProps> = ({ children, className, glow = false }) => {
  return (
    <div 
      className={cn(
        "glass-card p-6",
        glow && "cyber-glow",
        className
      )}
    >
      {children}
    </div>
  );
};

export default GlassCard;
