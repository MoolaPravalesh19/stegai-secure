import React, { useEffect, useState } from 'react';
import { Clock, CheckCircle, AlertCircle, ChevronRight, History, Loader2, MessageSquare, Image } from 'lucide-react';
import GlassCard from './GlassCard';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow, format } from 'date-fns';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface HistoryItem {
  id: string;
  created_at: string;
  operation_type: 'encode' | 'decode';
  status: 'success' | 'error';
  filename: string | null;
  encoding_time_ms: number | null;
  psnr_value: number | null;
  message: string | null;
  cover_image_url: string | null;
  stego_image_url: string | null;
  ssim_score: number | null;
}

const HistorySidebar: React.FC = () => {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    // Check auth state
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      fetchHistory();
    } else {
      setHistory([]);
      setLoading(false);
    }
  }, [user]);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('encryption_history')
        .select('id, created_at, operation_type, status, filename, encoding_time_ms, psnr_value, message, cover_image_url, stego_image_url, ssim_score')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setHistory((data || []) as HistoryItem[]);
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpanded = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  const formatFullTimestamp = (timestamp: string) => {
    try {
      return format(new Date(timestamp), 'MMM d, yyyy \'at\' h:mm a');
    } catch {
      return 'Unknown date';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
    } catch {
      return 'Unknown';
    }
  };

  return (
    <GlassCard className="h-full flex flex-col max-h-[300px] lg:max-h-none">
      <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
        <div className="p-1.5 sm:p-2 rounded-md sm:rounded-lg bg-primary/10">
          <History className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
        </div>
        <div>
          <h3 className="font-mono font-semibold text-sm sm:text-base text-foreground">History</h3>
          <p className="text-xs text-muted-foreground">Recent operations</p>
        </div>
      </div>
      
      <div className="flex-1 space-y-2 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-6 sm:py-8">
            <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 text-primary animate-spin" />
          </div>
        ) : !user ? (
          <div className="text-center py-6 sm:py-8">
            <p className="text-xs sm:text-sm text-muted-foreground">Sign in to view your history</p>
          </div>
        ) : history.length === 0 ? (
          <div className="text-center py-6 sm:py-8">
            <p className="text-xs sm:text-sm text-muted-foreground">No operations yet</p>
          </div>
        ) : (
          history.map((item, index) => (
            <Collapsible
              key={item.id}
              open={expandedId === item.id}
              onOpenChange={() => toggleExpanded(item.id)}
              className="animate-fade-in"
              style={{ animationDelay: `${index * 50}ms` } as React.CSSProperties}
            >
              <CollapsibleTrigger asChild>
                <div className="history-item cursor-pointer">
                  <div className={cn(
                    "p-1 sm:p-1.5 rounded-md",
                    item.status === 'success' ? 'bg-cyber-green/10' : 'bg-destructive/10'
                  )}>
                    {item.status === 'success' ? (
                      <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 text-cyber-green" />
                    ) : (
                      <AlertCircle className="w-3 h-3 sm:w-4 sm:h-4 text-destructive" />
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-foreground truncate">
                      {item.filename || 'Untitled'}
                    </p>
                    <div className="flex items-center gap-1 sm:gap-1.5 text-xs text-muted-foreground flex-wrap">
                      <span className={cn(
                        "px-1 sm:px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] uppercase font-medium",
                        item.operation_type === 'encode' ? 'bg-primary/10 text-primary' : 'bg-secondary/10 text-secondary'
                      )}>
                        {item.operation_type}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5 text-muted-foreground">
                      <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                      <span className="text-[10px] sm:text-xs">{formatTimestamp(item.created_at)}</span>
                      {item.encoding_time_ms && (
                        <span className="text-[10px] sm:text-xs">• {item.encoding_time_ms}ms</span>
                      )}
                    </div>
                  </div>
                  
                  <ChevronRight 
                    className={cn(
                      "w-3 h-3 sm:w-4 sm:h-4 text-muted-foreground transition-transform duration-200",
                      expandedId === item.id && "rotate-90"
                    )} 
                  />
                </div>
              </CollapsibleTrigger>
              
              <CollapsibleContent className="overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0">
                <div className="mt-2 p-2 sm:p-3 bg-muted/30 rounded-lg border border-border/50 space-y-3">
                  {/* Secret Message */}
                  <div>
                    <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                      <MessageSquare className="w-3 h-3" />
                      <span className="text-[10px] sm:text-xs font-medium uppercase">Secret Message</span>
                    </div>
                    <p className="text-xs sm:text-sm text-foreground bg-background/50 p-2 rounded border border-border/30 break-words">
                      {item.message || <span className="text-muted-foreground italic">No message recorded</span>}
                    </p>
                  </div>

                  {/* Quality Metrics */}
                  {(item.psnr_value || item.ssim_score) && (
                    <div>
                      <span className="text-[10px] sm:text-xs font-medium uppercase text-muted-foreground">Quality Metrics</span>
                      <div className="grid grid-cols-2 gap-2 mt-1">
                        {item.psnr_value && (
                          <div className="bg-background/50 p-2 rounded border border-border/30">
                            <span className="text-[10px] text-muted-foreground">PSNR</span>
                            <p className="text-sm font-mono font-semibold text-cyber-cyan">{Number(item.psnr_value).toFixed(2)} dB</p>
                          </div>
                        )}
                        {item.ssim_score && (
                          <div className="bg-background/50 p-2 rounded border border-border/30">
                            <span className="text-[10px] text-muted-foreground">SSIM</span>
                            <p className="text-sm font-mono font-semibold text-cyber-purple">{Number(item.ssim_score).toFixed(4)}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Image Previews */}
                  {(item.cover_image_url || item.stego_image_url) && (
                    <div>
                      <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                        <Image className="w-3 h-3" />
                        <span className="text-[10px] sm:text-xs font-medium uppercase">Images</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {item.cover_image_url && (
                          <div className="space-y-1">
                            <span className="text-[10px] text-muted-foreground">Cover</span>
                            <img 
                              src={item.cover_image_url} 
                              alt="Cover" 
                              className="w-full h-16 object-cover rounded border border-border/30"
                            />
                          </div>
                        )}
                        {item.stego_image_url && (
                          <div className="space-y-1">
                            <span className="text-[10px] text-muted-foreground">Stego</span>
                            <img 
                              src={item.stego_image_url} 
                              alt="Stego" 
                              className="w-full h-16 object-cover rounded border border-border/30"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Full Timestamp */}
                  <div className="pt-2 border-t border-border/30">
                    <span className="text-[10px] text-muted-foreground">
                      Created: {formatFullTimestamp(item.created_at)}
                    </span>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          ))
        )}
      </div>
    </GlassCard>
  );
};

export default HistorySidebar;
