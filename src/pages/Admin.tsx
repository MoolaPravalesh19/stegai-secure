import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, History, HardDrive, BarChart3, ArrowLeft, Shield, Trash2, Image, Download, Search, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, ShieldCheck, ShieldAlert, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import ThemeToggle from '@/components/ThemeToggle';
import CyberGrid from '@/components/CyberGrid';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { exportToCSV } from '@/lib/csvExport';
import { toast } from 'sonner';
import { AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

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
interface DailyOps {
  date: string;
  encodes: number;
  decodes: number;
  total: number;
}

interface DailyQuality {
  date: string;
  avg_psnr: number | null;
  avg_ssim: number | null;
}

type SortDir = 'asc' | 'desc' | null;
interface SortState<T extends string> { key: T; dir: SortDir; }

type AppRole = 'admin' | 'moderator' | 'user';
interface UserRole { id: string; user_id: string; role: AppRole; }

function toggleSort<T extends string>(current: SortState<T>, key: T): SortState<T> {
  if (current.key !== key) return { key, dir: 'asc' };
  if (current.dir === 'asc') return { key, dir: 'desc' };
  return { key, dir: null };
}

function sortData<T>(data: T[], key: keyof T | null, dir: SortDir): T[] {
  if (!key || !dir) return data;
  return [...data].sort((a, b) => {
    const av = a[key], bv = b[key];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === 'number' && typeof bv === 'number') return dir === 'asc' ? av - bv : bv - av;
    const sa = String(av).toLowerCase(), sb = String(bv).toLowerCase();
    return dir === 'asc' ? sa.localeCompare(sb) : sb.localeCompare(sa);
  });
}

const SortIcon: React.FC<{ dir: SortDir }> = ({ dir }) => {
  if (dir === 'asc') return <ArrowUp className="inline w-3 h-3 ml-1" />;
  if (dir === 'desc') return <ArrowDown className="inline w-3 h-3 ml-1" />;
  return <ArrowUpDown className="inline w-3 h-3 ml-1 opacity-40" />;
};

const CHART_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--cyber-green, 142 71% 45%))',
  'hsl(var(--cyber-purple, 270 70% 60%))',
  'hsl(var(--cyber-cyan, 190 90% 50%))',
];

const Admin: React.FC = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();

  const [stats, setStats] = useState<Stats | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [storageFiles, setStorageFiles] = useState<StorageFile[]>([]);
  const [opsOverTime, setOpsOverTime] = useState<DailyOps[]>([]);
  const [qualityOverTime, setQualityOverTime] = useState<DailyQuality[]>([]);
  const [activeTab, setActiveTab] = useState('analytics');
  const [dataLoading, setDataLoading] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [historySearch, setHistorySearch] = useState('');
  const [userPage, setUserPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const [userSort, setUserSort] = useState<SortState<keyof Profile>>({ key: 'created_at', dir: null });
  const [historySort, setHistorySort] = useState<SortState<keyof HistoryItem>>({ key: 'created_at', dir: null });
  const [userRoles, setUserRoles] = useState<Record<string, AppRole[]>>({});
  const [roleUpdating, setRoleUpdating] = useState<string | null>(null);
  const PAGE_SIZE = 10;

  const filteredProfiles = useMemo(() => {
    let data = profiles;
    if (userSearch.trim()) {
      const q = userSearch.toLowerCase();
      data = data.filter(p =>
        (p.email?.toLowerCase().includes(q)) ||
        (p.display_name?.toLowerCase().includes(q))
      );
    }
    return sortData(data, userSort.dir ? userSort.key : null, userSort.dir);
  }, [profiles, userSearch, userSort]);

  const filteredHistory = useMemo(() => {
    let data = history;
    if (historySearch.trim()) {
      const q = historySearch.toLowerCase();
      data = data.filter(h =>
        h.operation_type.toLowerCase().includes(q) ||
        h.status.toLowerCase().includes(q) ||
        (h.filename?.toLowerCase().includes(q)) ||
        (h.message?.toLowerCase().includes(q))
      );
    }
    return sortData(data, historySort.dir ? historySort.key : null, historySort.dir);
  }, [history, historySearch, historySort]);

  const paginatedProfiles = useMemo(() => {
    const start = (userPage - 1) * PAGE_SIZE;
    return filteredProfiles.slice(start, start + PAGE_SIZE);
  }, [filteredProfiles, userPage]);

  const paginatedHistory = useMemo(() => {
    const start = (historyPage - 1) * PAGE_SIZE;
    return filteredHistory.slice(start, start + PAGE_SIZE);
  }, [filteredHistory, historyPage]);

  const userTotalPages = Math.max(1, Math.ceil(filteredProfiles.length / PAGE_SIZE));
  const historyTotalPages = Math.max(1, Math.ceil(filteredHistory.length / PAGE_SIZE));

  // Reset page when search changes
  useEffect(() => { setUserPage(1); }, [userSearch]);
  useEffect(() => { setHistoryPage(1); }, [historySearch]);

  const handleDeleteUser = async (userId: string) => {
    setDeletingUserId(userId);
    try {
      const { data, error } = await supabase.rpc('admin_delete_user' as any, { target_user_id: userId });
      if (error) throw error;
      toast.success('User and associated data deleted successfully');
      setProfiles(prev => prev.filter(p => p.user_id !== userId));
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete user');
    }
    setDeletingUserId(null);
  };

  const handleExportCSV = (tab: string) => {
    switch (tab) {
      case 'analytics':
        if (opsOverTime.length) exportToCSV(opsOverTime as any, 'operations_over_time');
        if (qualityOverTime.length) exportToCSV(qualityOverTime as any, 'quality_over_time');
        if (stats) exportToCSV([stats as any], 'stats_summary');
        toast.success('Analytics data exported');
        break;
      case 'users':
        exportToCSV(profiles as any, 'users');
        toast.success('Users data exported');
        break;
      case 'history':
        exportToCSV(history as any, 'operation_history');
        toast.success('History data exported');
        break;
      case 'storage':
        exportToCSV(storageFiles as any, 'storage_files');
        toast.success('Storage data exported');
        break;
    }
  };

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
        case 'analytics': {
          const [{ data: statsData }, { data: opsData }, { data: qualData }] = await Promise.all([
            supabase.rpc('admin_get_stats'),
            supabase.rpc('admin_get_operations_over_time' as any),
            supabase.rpc('admin_get_quality_over_time' as any),
          ]);
          if (statsData) setStats(statsData as unknown as Stats);
          if (opsData) setOpsOverTime(opsData as unknown as DailyOps[]);
          if (qualData) setQualityOverTime(qualData as unknown as DailyQuality[]);
          break;
        }
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
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => handleExportCSV(activeTab)} className="flex items-center gap-1.5 text-xs">
              <Download className="w-3.5 h-3.5" /> Export CSV
            </Button>
            <ThemeToggle />
          </div>
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
                <>
                  {/* Stat Cards */}
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

                  {/* Operations Over Time - Area Chart */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
                    <Card className="glass-card border-border/40">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-mono">Operations Over Time (30 days)</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={opsOverTime}>
                              <defs>
                                <linearGradient id="gradEncode" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor={CHART_COLORS[1]} stopOpacity={0.4} />
                                  <stop offset="95%" stopColor={CHART_COLORS[1]} stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="gradDecode" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor={CHART_COLORS[2]} stopOpacity={0.4} />
                                  <stop offset="95%" stopColor={CHART_COLORS[2]} stopOpacity={0} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                              <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => v.slice(5)} />
                              <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} />
                              <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                              <Area type="monotone" dataKey="encodes" stroke={CHART_COLORS[1]} fill="url(#gradEncode)" name="Encodes" />
                              <Area type="monotone" dataKey="decodes" stroke={CHART_COLORS[2]} fill="url(#gradDecode)" name="Decodes" />
                              <Legend wrapperStyle={{ fontSize: 11 }} />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Daily Bar Chart */}
                    <Card className="glass-card border-border/40">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-mono">Daily Total Operations</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={opsOverTime}>
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                              <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => v.slice(5)} />
                              <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} />
                              <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                              <Bar dataKey="encodes" stackId="ops" fill={CHART_COLORS[1]} name="Encodes" radius={[0, 0, 0, 0]} />
                              <Bar dataKey="decodes" stackId="ops" fill={CHART_COLORS[2]} name="Decodes" radius={[4, 4, 0, 0]} />
                              <Legend wrapperStyle={{ fontSize: 11 }} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Quality & Pie Charts */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <Card className="glass-card border-border/40">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-mono">Quality Metrics Over Time</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={qualityOverTime}>
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                              <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => v.slice(5)} />
                              <YAxis yAxisId="psnr" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} label={{ value: 'PSNR (dB)', angle: -90, position: 'insideLeft', style: { fontSize: 10, fill: 'hsl(var(--muted-foreground))' } }} />
                              <YAxis yAxisId="ssim" orientation="right" domain={[0, 1]} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} label={{ value: 'SSIM', angle: 90, position: 'insideRight', style: { fontSize: 10, fill: 'hsl(var(--muted-foreground))' } }} />
                              <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                              <Line yAxisId="psnr" type="monotone" dataKey="avg_psnr" stroke={CHART_COLORS[3]} strokeWidth={2} dot={false} name="Avg PSNR" connectNulls />
                              <Line yAxisId="ssim" type="monotone" dataKey="avg_ssim" stroke={CHART_COLORS[0]} strokeWidth={2} dot={false} name="Avg SSIM" connectNulls />
                              <Legend wrapperStyle={{ fontSize: 11 }} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Encode vs Decode Pie */}
                    <Card className="glass-card border-border/40">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-mono">Encode vs Decode Breakdown</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={[
                                  { name: 'Encodes', value: stats.total_encodes },
                                  { name: 'Decodes', value: stats.total_decodes },
                                ]}
                                cx="50%"
                                cy="50%"
                                innerRadius={50}
                                outerRadius={80}
                                paddingAngle={4}
                                dataKey="value"
                                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                labelLine={false}
                              >
                                <Cell fill={CHART_COLORS[1]} />
                                <Cell fill={CHART_COLORS[2]} />
                              </Pie>
                              <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                              <Legend wrapperStyle={{ fontSize: 11 }} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  {dataLoading ? 'Loading analytics...' : 'No data available'}
                </div>
              )}
            </TabsContent>

            {/* Users Tab */}
            <TabsContent value="users">
              <Card className="glass-card border-border/40">
                <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
                  <CardTitle className="text-base font-mono">Registered Users ({filteredProfiles.length})</CardTitle>
                  <div className="relative w-full max-w-xs">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by email or name..."
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      className="pl-9 h-9 text-sm bg-background/50"
                    />
                  </div>
                </CardHeader>
                <CardContent>
                  {dataLoading ? (
                    <div className="text-center py-8 text-muted-foreground">Loading users...</div>
                  ) : paginatedProfiles.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      {userSearch ? 'No users match your search.' : 'No users found.'}
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="cursor-pointer select-none" onClick={() => setUserSort(s => toggleSort(s, 'email'))}>
                            Email <SortIcon dir={userSort.key === 'email' ? userSort.dir : null} />
                          </TableHead>
                          <TableHead className="cursor-pointer select-none" onClick={() => setUserSort(s => toggleSort(s, 'display_name'))}>
                            Display Name <SortIcon dir={userSort.key === 'display_name' ? userSort.dir : null} />
                          </TableHead>
                          <TableHead className="cursor-pointer select-none" onClick={() => setUserSort(s => toggleSort(s, 'created_at'))}>
                            Joined <SortIcon dir={userSort.key === 'created_at' ? userSort.dir : null} />
                          </TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedProfiles.map((p) => (
                          <TableRow key={p.id}>
                            <TableCell className="font-mono text-xs">{p.email || '—'}</TableCell>
                            <TableCell>{p.display_name || '—'}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{formatDate(p.created_at)}</TableCell>
                            <TableCell className="text-right">
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" disabled={deletingUserId === p.user_id}>
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete User</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will permanently delete <strong>{p.email || 'this user'}</strong> and all their associated data (history, files, roles). This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDeleteUser(p.user_id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                      Delete User
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
                {userTotalPages > 1 && (
                  <CardFooter className="flex items-center justify-between border-t border-border/30 pt-4">
                    <span className="text-xs text-muted-foreground">
                      Page {userPage} of {userTotalPages}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="icon" className="h-7 w-7" disabled={userPage <= 1} onClick={() => setUserPage(p => p - 1)}>
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="outline" size="icon" className="h-7 w-7" disabled={userPage >= userTotalPages} onClick={() => setUserPage(p => p + 1)}>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardFooter>
                )}
              </Card>
            </TabsContent>

            {/* History Tab */}
            <TabsContent value="history">
              <Card className="glass-card border-border/40">
                <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
                  <CardTitle className="text-base font-mono">All Operations ({filteredHistory.length})</CardTitle>
                  <div className="relative w-full max-w-xs">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by type, status, filename..."
                      value={historySearch}
                      onChange={(e) => setHistorySearch(e.target.value)}
                      className="pl-9 h-9 text-sm bg-background/50"
                    />
                  </div>
                </CardHeader>
                <CardContent>
                  {dataLoading ? (
                    <div className="text-center py-8 text-muted-foreground">Loading history...</div>
                  ) : paginatedHistory.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      {historySearch ? 'No operations match your search.' : 'No operations found.'}
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="cursor-pointer select-none" onClick={() => setHistorySort(s => toggleSort(s, 'operation_type'))}>
                              Type <SortIcon dir={historySort.key === 'operation_type' ? historySort.dir : null} />
                            </TableHead>
                            <TableHead className="cursor-pointer select-none" onClick={() => setHistorySort(s => toggleSort(s, 'status'))}>
                              Status <SortIcon dir={historySort.key === 'status' ? historySort.dir : null} />
                            </TableHead>
                            <TableHead className="cursor-pointer select-none" onClick={() => setHistorySort(s => toggleSort(s, 'filename'))}>
                              Filename <SortIcon dir={historySort.key === 'filename' ? historySort.dir : null} />
                            </TableHead>
                            <TableHead>Message</TableHead>
                            <TableHead className="cursor-pointer select-none" onClick={() => setHistorySort(s => toggleSort(s, 'psnr_value'))}>
                              PSNR <SortIcon dir={historySort.key === 'psnr_value' ? historySort.dir : null} />
                            </TableHead>
                            <TableHead className="cursor-pointer select-none" onClick={() => setHistorySort(s => toggleSort(s, 'ssim_score'))}>
                              SSIM <SortIcon dir={historySort.key === 'ssim_score' ? historySort.dir : null} />
                            </TableHead>
                            <TableHead>Images</TableHead>
                            <TableHead className="cursor-pointer select-none" onClick={() => setHistorySort(s => toggleSort(s, 'created_at'))}>
                              Date <SortIcon dir={historySort.key === 'created_at' ? historySort.dir : null} />
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paginatedHistory.map((h) => (
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
                {historyTotalPages > 1 && (
                  <CardFooter className="flex items-center justify-between border-t border-border/30 pt-4">
                    <span className="text-xs text-muted-foreground">
                      Page {historyPage} of {historyTotalPages}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="icon" className="h-7 w-7" disabled={historyPage <= 1} onClick={() => setHistoryPage(p => p - 1)}>
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="outline" size="icon" className="h-7 w-7" disabled={historyPage >= historyTotalPages} onClick={() => setHistoryPage(p => p + 1)}>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardFooter>
                )}
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
