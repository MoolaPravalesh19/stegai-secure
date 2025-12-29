import React, { useEffect, useState } from 'react';
import { Clock, CheckCircle, AlertCircle, ChevronRight, History, Loader2 } from 'lucide-react';
import GlassCard from './GlassCard';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';

interface HistoryItem {
  id: string;
  created_at: string;
  operation_type: 'encode' | 'decode';
  status: 'success' | 'error';
  filename: string | null;
}

const HistorySidebar: React.FC = () => {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

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
        .select('id, created_at, operation_type, status, filename')
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

  const formatTimestamp = (timestamp: string) => {
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
    } catch {
      return 'Unknown';
    }
  };

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
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : !user ? (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">Sign in to view your history</p>
          </div>
        ) : history.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">No operations yet</p>
          </div>
        ) : (
          history.map((item, index) => (
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
                  {item.filename || 'Untitled'}
                </p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className={cn(
                    "px-1.5 py-0.5 rounded text-[10px] uppercase font-medium",
                    item.operation_type === 'encode' ? 'bg-primary/10 text-primary' : 'bg-secondary/10 text-secondary'
                  )}>
                    {item.operation_type}
                  </span>
                  <Clock className="w-3 h-3" />
                  <span>{formatTimestamp(item.created_at)}</span>
                </div>
              </div>
              
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </div>
          ))
        )}
      </div>
      
      <div className="mt-4 pt-4 border-t border-border/50">
        <p className="text-xs text-muted-foreground text-center">
          Powered by <span className="text-primary font-mono">Lovable Cloud</span>
        </p>
      </div>
    </GlassCard>
  );
};

export default HistorySidebar;
