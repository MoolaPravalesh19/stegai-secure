import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, History, HardDrive, BarChart3, ArrowLeft, Shield, Trash2, Image } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import ThemeToggle from '@/components/ThemeToggle';
import CyberGrid from '@/components/CyberGrid';

interface Stats {
  total_users: number;
  total_operations: number;
  total_encodes: number;
  total_decodes: number;
  operations_today: number;
  avg_psnr: number | null;
  avg_ssim: number | null;
}

interface Profile {
  id: string;
  user_id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

interface HistoryItem {
  id: string;
  user_id: string;
  operation_type: string;
  status: string;
  filename: string | null;
  message: string | null;
  cover_image_url: string | null;
  stego_image_url: string | null;
  psnr_value: number | null;
  ssim_score: number | null;
  encoding_time_ms: number | null;
  created_at: string;
}

interface StorageFile {
  id: string;
  name: string;
  bucket_id: string;
  created_at: string;
  metadata: Record<string, unknown> | null;
}

const Admin: React.FC = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();

  const [stats, setStats] = useState<Stats | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [storageFiles, setStorageFiles] = useState<StorageFile[]>([]);
  const [activeTab, setActiveTab] = useState('analytics');
  const [dataLoading, setDataLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && !adminLoading) {
      if (!user || !isAdmin) {
        navigate('/');
      }
    }
  }, [user, isAdmin, authLoading, adminLoading, navigate]);

  useEffect(() => {
    if (isAdmin) {
      loadData(activeTab);
    }
  }, [isAdmin, activeTab]);

  const loadData = async (tab: string) => {
    setDataLoading(true);
    try {
      switch (tab) {
        case 'analytics':
          const { data: statsData } = await supabase.rpc('admin_get_stats');
          if (statsData) setStats(statsData as unknown as Stats);
          break;
        case 'users':
          const { data: profilesData } = await supabase.rpc('admin_get_all_profiles');
          if (profilesData) setProfiles(profilesData as unknown as Profile[]);
          break;
        case 'history':
          const { data: historyData } = await supabase.rpc('admin_get_all_history');
          if (historyData) setHistory(historyData as unknown as HistoryItem[]);
          break;
        case 'storage':
          const { data: filesData } = await supabase.rpc('admin_list_storage_files', { bucket: 'stego-images' });
          if (filesData) setStorageFiles(filesData as unknown as StorageFile[]);
          break;
      }
    } catch (error) {
      console.error('Error loading admin data:', error);
    }
    setDataLoading(false);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  if (authLoading || adminLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground font-mono">Verifying access...</div>
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen relative">
      <CyberGrid />
      
      <header className="fixed top-0 left-0 right-0 z-50 px-3 sm:px-6 py-3 sm:py-4 backdrop-blur-xl bg-background/60 border-b border-border/30">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              <span className="font-mono font-bold text-lg text-foreground">Admin Panel</span>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <div className="relative z-10 pt-20 pb-10">
        <div className="max-w-7xl mx-auto px-3 sm:px-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-4 w-full max-w-lg mb-6 bg-muted/50 border border-border/30">
              <TabsTrigger value="analytics" className="flex items-center gap-1.5 text-xs sm:text-sm">
                <BarChart3 className="w-3.5 h-3.5" /> Analytics
              </TabsTrigger>
              <TabsTrigger value="users" className="flex items-center gap-1.5 text-xs sm:text-sm">
                <Users className="w-3.5 h-3.5" /> Users
              </TabsTrigger>
              <TabsTrigger value="history" className="flex items-center gap-1.5 text-xs sm:text-sm">
                <History className="w-3.5 h-3.5" /> History
              </TabsTrigger>
              <TabsTrigger value="storage" className="flex items-center gap-1.5 text-xs sm:text-sm">
                <HardDrive className="w-3.5 h-3.5" /> Storage
              </TabsTrigger>
            </TabsList>

            {/* Analytics Tab */}
            <TabsContent value="analytics">
              {stats ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  {[
                    { label: 'Total Users', value: stats.total_users, color: 'text-primary' },
                    { label: 'Total Operations', value: stats.total_operations, color: 'text-accent-foreground' },
                    { label: 'Encodes', value: stats.total_encodes, color: 'text-[hsl(var(--cyber-green))]' },
                    { label: 'Decodes', value: stats.total_decodes, color: 'text-[hsl(var(--cyber-purple))]' },
                    { label: 'Today\'s Ops', value: stats.operations_today, color: 'text-[hsl(var(--cyber-cyan))]' },
                    { label: 'Avg PSNR', value: stats.avg_psnr ? `${stats.avg_psnr} dB` : 'N/A', color: 'text-[hsl(var(--cyber-pink))]' },
                    { label: 'Avg SSIM', value: stats.avg_ssim ?? 'N/A', color: 'text-primary' },
                  ].map((stat, i) => (
                    <Card key={i} className="glass-card border-border/40">
                      <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider">{stat.label}</p>
                        <p className={`text-2xl font-bold font-mono mt-1 ${stat.color}`}>{stat.value}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  {dataLoading ? 'Loading analytics...' : 'No data available'}
                </div>
              )}
            </TabsContent>

            {/* Users Tab */}
            <TabsContent value="users">
              <Card className="glass-card border-border/40">
                <CardHeader>
                  <CardTitle className="text-base font-mono">Registered Users ({profiles.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  {dataLoading ? (
                    <div className="text-center py-8 text-muted-foreground">Loading users...</div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Email</TableHead>
                          <TableHead>Display Name</TableHead>
                          <TableHead>Joined</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {profiles.map((p) => (
                          <TableRow key={p.id}>
                            <TableCell className="font-mono text-xs">{p.email || '—'}</TableCell>
                            <TableCell>{p.display_name || '—'}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{formatDate(p.created_at)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* History Tab */}
            <TabsContent value="history">
              <Card className="glass-card border-border/40">
                <CardHeader>
                  <CardTitle className="text-base font-mono">All Operations ({history.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  {dataLoading ? (
                    <div className="text-center py-8 text-muted-foreground">Loading history...</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Type</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Filename</TableHead>
                            <TableHead>Message</TableHead>
                            <TableHead>PSNR</TableHead>
                            <TableHead>SSIM</TableHead>
                            <TableHead>Images</TableHead>
                            <TableHead>Date</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {history.map((h) => (
                            <TableRow key={h.id}>
                              <TableCell>
                                <Badge variant={h.operation_type === 'encode' ? 'default' : 'secondary'} className="text-xs">
                                  {h.operation_type}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant={h.status === 'success' ? 'outline' : 'destructive'} className="text-xs">
                                  {h.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-mono text-xs max-w-[120px] truncate">{h.filename || '—'}</TableCell>
                              <TableCell className="max-w-[150px] truncate text-xs">{h.message || '—'}</TableCell>
                              <TableCell className="font-mono text-xs">{h.psnr_value ? `${h.psnr_value} dB` : '—'}</TableCell>
                              <TableCell className="font-mono text-xs">{h.ssim_score ?? '—'}</TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  {h.cover_image_url && (
                                    <a href={h.cover_image_url} target="_blank" rel="noopener noreferrer">
                                      <Image className="w-4 h-4 text-primary hover:text-primary/70" />
                                    </a>
                                  )}
                                  {h.stego_image_url && (
                                    <a href={h.stego_image_url} target="_blank" rel="noopener noreferrer">
                                      <Image className="w-4 h-4 text-[hsl(var(--cyber-green))] hover:opacity-70" />
                                    </a>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(h.created_at)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Storage Tab */}
            <TabsContent value="storage">
              <Card className="glass-card border-border/40">
                <CardHeader>
                  <CardTitle className="text-base font-mono">Storage Files ({storageFiles.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  {dataLoading ? (
                    <div className="text-center py-8 text-muted-foreground">Loading files...</div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Filename</TableHead>
                          <TableHead>Bucket</TableHead>
                          <TableHead>Uploaded</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {storageFiles.map((f) => (
                          <TableRow key={f.id}>
                            <TableCell className="font-mono text-xs max-w-[250px] truncate">{f.name}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">{f.bucket_id}</Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">{formatDate(f.created_at)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default Admin;
