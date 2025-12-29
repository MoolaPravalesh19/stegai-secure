import React from 'react';
import { Clock, CheckCircle, AlertCircle, ChevronRight, History } from 'lucide-react';
import GlassCard from './GlassCard';
import { cn } from '@/lib/utils';

interface HistoryItem {
  id: string;
  timestamp: string;
  type: 'encode' | 'decode';
  status: 'success' | 'error';
  filename: string;
}

const mockHistory: HistoryItem[] = [
  { id: '1', timestamp: '2 min ago', type: 'encode', status: 'success', filename: 'secret_doc.png' },
  { id: '2', timestamp: '15 min ago', type: 'decode', status: 'success', filename: 'message_img.jpg' },
  { id: '3', timestamp: '1 hour ago', type: 'encode', status: 'error', filename: 'failed_encode.png' },
  { id: '4', timestamp: '2 hours ago', type: 'encode', status: 'success', filename: 'confidential.png' },
  { id: '5', timestamp: '3 hours ago', type: 'decode', status: 'success', filename: 'reveal_data.jpg' },
];

const HistorySidebar: React.FC = () => {
  return (
    <GlassCard className="h-full flex flex-col">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-primary/10">
          <History className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="font-mono font-semibold text-foreground">History</h3>
          <p className="text-xs text-muted-foreground">Recent operations</p>
        </div>
      </div>
      
      <div className="flex-1 space-y-2 overflow-y-auto">
        {mockHistory.map((item, index) => (
          <div 
            key={item.id}
            className="history-item animate-fade-in"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div className={cn(
              "p-1.5 rounded-md",
              item.status === 'success' ? 'bg-cyber-green/10' : 'bg-destructive/10'
            )}>
              {item.status === 'success' ? (
                <CheckCircle className="w-4 h-4 text-cyber-green" />
              ) : (
                <AlertCircle className="w-4 h-4 text-destructive" />
              )}
            </div>
            
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {item.filename}
              </p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className={cn(
                  "px-1.5 py-0.5 rounded text-[10px] uppercase font-medium",
                  item.type === 'encode' ? 'bg-primary/10 text-primary' : 'bg-secondary/10 text-secondary'
                )}>
                  {item.type}
                </span>
                <Clock className="w-3 h-3" />
                <span>{item.timestamp}</span>
              </div>
            </div>
            
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </div>
        ))}
      </div>
      
      <div className="mt-4 pt-4 border-t border-border/50">
        <p className="text-xs text-muted-foreground text-center">
          Powered by <span className="text-primary font-mono">Supabase</span>
        </p>
      </div>
    </GlassCard>
  );
};

export default HistorySidebar;
