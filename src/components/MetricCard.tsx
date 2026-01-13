import React from 'react';
import GlassCard from './GlassCard';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  label: string;
  value: string;
  unit?: string;
  icon: React.ReactNode;
  color?: 'cyan' | 'purple' | 'green' | 'pink';
  progress?: number;
}

const colorClasses = {
  cyan: 'text-cyber-cyan',
  purple: 'text-cyber-purple',
  green: 'text-cyber-green',
  pink: 'text-cyber-pink',
};

const bgClasses = {
  cyan: 'bg-cyber-cyan',
  purple: 'bg-cyber-purple',
  green: 'bg-cyber-green',
  pink: 'bg-cyber-pink',
};

const MetricCard: React.FC<MetricCardProps> = ({ 
  label, 
  value, 
  unit, 
  icon, 
  color = 'cyan',
  progress 
}) => {
  return (
    <GlassCard className="relative overflow-hidden group hover:border-primary/50 transition-all duration-300 p-3 sm:p-4">
      {/* Background glow */}
      <div 
        className={cn(
          "absolute -top-10 -right-10 w-24 h-24 sm:w-32 sm:h-32 rounded-full opacity-10 blur-2xl transition-opacity duration-300 group-hover:opacity-20",
          bgClasses[color]
        )}
      />
      
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-2 sm:mb-4">
          <span className="text-muted-foreground text-xs sm:text-sm font-medium uppercase tracking-wider line-clamp-1">
            {label}
          </span>
          <div className={cn("p-1.5 sm:p-2 rounded-md sm:rounded-lg bg-muted/50", colorClasses[color])}>
            {icon}
          </div>
        </div>
        
        <div className="flex items-baseline gap-1 sm:gap-2">
          <span className={cn("text-xl sm:text-3xl font-mono font-bold tracking-tight", colorClasses[color])}>
            {value}
          </span>
          {unit && (
            <span className="text-muted-foreground text-sm sm:text-lg font-mono">
              {unit}
            </span>
          )}
        </div>
        
        {progress !== undefined && (
          <div className="mt-2 sm:mt-4">
            <div className="h-1 sm:h-1.5 bg-muted rounded-full overflow-hidden">
              <div 
                className={cn("h-full rounded-full transition-all duration-500", bgClasses[color])}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </GlassCard>
  );
};

export default MetricCard;
