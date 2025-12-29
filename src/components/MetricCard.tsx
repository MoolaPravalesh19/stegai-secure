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
    <GlassCard className="relative overflow-hidden group hover:border-primary/50 transition-all duration-300">
      {/* Background glow */}
      <div 
        className={cn(
          "absolute -top-10 -right-10 w-32 h-32 rounded-full opacity-10 blur-2xl transition-opacity duration-300 group-hover:opacity-20",
          bgClasses[color]
        )}
      />
      
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <span className="text-muted-foreground text-sm font-medium uppercase tracking-wider">
            {label}
          </span>
          <div className={cn("p-2 rounded-lg bg-muted/50", colorClasses[color])}>
            {icon}
          </div>
        </div>
        
        <div className="flex items-baseline gap-2">
          <span className={cn("metric-value", colorClasses[color])}>
            {value}
          </span>
          {unit && (
            <span className="text-muted-foreground text-lg font-mono">
              {unit}
            </span>
          )}
        </div>
        
        {progress !== undefined && (
          <div className="mt-4">
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
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
