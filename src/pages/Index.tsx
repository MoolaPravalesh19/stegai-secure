import React from 'react';
import { Activity, Timer, BarChart3, Zap, LogOut, User } from 'lucide-react';
import { Link } from 'react-router-dom';
import CyberGrid from '@/components/CyberGrid';
import HeroSection from '@/components/HeroSection';
import WorkspacePanel from '@/components/WorkspacePanel';
import MetricCard from '@/components/MetricCard';
import ComparisonSlider from '@/components/ComparisonSlider';
import HistorySidebar from '@/components/HistorySidebar';
import ArchitectureOverview from '@/components/ArchitectureOverview';
import ThemeToggle from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';

const Index: React.FC = () => {
  const { user, profile, loading, signOut } = useAuth();

  return (
    <div className="min-h-screen relative">
      <CyberGrid />
      
      {/* Auth Header */}
      <header className="fixed top-0 left-0 right-0 z-50 px-3 sm:px-6 py-3 sm:py-4 backdrop-blur-xl bg-background/60 border-b border-border/30 animate-fade-in">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 group cursor-pointer hover-scale">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg shadow-primary/20 group-hover:shadow-primary/40 transition-shadow duration-300">
              <img src="https://ulzfwccoarvbvmrekcgx.supabase.co/storage/v1/object/public/stego-images/logo.png" alt="" />
            </div>
            <span className="font-mono font-bold text-base sm:text-lg text-foreground">StegAI</span>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle />
            
            {loading ? (
              <div className="w-20 h-8 bg-muted/30 rounded-md animate-pulse" />
            ) : user ? (
              <div className="flex items-center gap-2 sm:gap-3 animate-fade-in">
                <span className="text-xs sm:text-sm text-muted-foreground hidden md:block max-w-[150px] truncate">
                  {profile?.display_name || profile?.email || user.email}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={signOut}
                  className="bg-muted/30 border-border/50 hover:bg-muted/50 hover:scale-105 transition-all duration-200 text-xs sm:text-sm px-2 sm:px-3"
                >
                  <LogOut className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Sign Out</span>
                </Button>
              </div>
            ) : (
              <Link to="/auth" className="animate-fade-in">
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-muted/30 border-border/50 hover:bg-primary/20 hover:border-primary/50 hover:scale-105 transition-all duration-200 hover:shadow-lg hover:shadow-primary/20 text-xs sm:text-sm px-2 sm:px-3"
                >
                  <User className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Sign In</span>
                </Button>
              </Link>
            )}
          </div>
        </div>
      </header>
      
      <div className="relative z-10 pt-16 sm:pt-20">
        <div className="max-w-7xl mx-auto px-3 sm:px-6">
          {/* Hero Section */}
          <HeroSection />
          
          {/* Main Grid Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-10">
            {/* Left Column - Workspace */}
            <div className="lg:col-span-2 space-y-4 sm:space-y-6 order-2 lg:order-1">
            {/* Metrics Dashboard */}
              <section className="animate-fade-in" style={{ animationDelay: '100ms' }}>
                <h2 className="font-mono text-xs sm:text-sm uppercase tracking-wider text-muted-foreground mb-3 sm:mb-4">
                  Performance Metrics
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
                  <div className="animate-fade-in" style={{ animationDelay: '150ms' }}>
                    <MetricCard
                      label="PSNR Value"
                      value="42.5"
                      unit="dB"
                      icon={<Activity className="w-5 h-5" />}
                      color="cyan"
                      progress={85}
                    />
                  </div>
                  <div className="animate-fade-in" style={{ animationDelay: '200ms' }}>
                    <MetricCard
                      label="SSIM Score"
                      value="0.98"
                      icon={<BarChart3 className="w-5 h-5" />}
                      color="purple"
                      progress={98}
                    />
                  </div>
                  <div className="animate-fade-in" style={{ animationDelay: '250ms' }}>
                    <MetricCard
                      label="Encoding Time"
                      value="1.2"
                      unit="sec"
                      icon={<Timer className="w-5 h-5" />}
                      color="green"
                      progress={40}
                    />
                  </div>
                  <div className="animate-fade-in" style={{ animationDelay: '300ms' }}>
                    <MetricCard
                      label="Capacity"
                      value="2.4"
                      unit="bpp"
                      icon={<Zap className="w-5 h-5" />}
                      color="pink"
                      progress={60}
                    />
                  </div>
                </div>
              </section>
              
              {/* Workspace Panels */}
              <section className="animate-fade-in" style={{ animationDelay: '350ms' }}>
                <h2 className="font-mono text-xs sm:text-sm uppercase tracking-wider text-muted-foreground mb-3 sm:mb-4">
                  Workspace
                </h2>
                <WorkspacePanel />
              </section>
              
              {/* Visual Comparison */}
              <section className="animate-fade-in" style={{ animationDelay: '400ms' }}>
                <h2 className="font-mono text-xs sm:text-sm uppercase tracking-wider text-muted-foreground mb-3 sm:mb-4">
                  Visual Analysis
                </h2>
                <ComparisonSlider />
              </section>
              
              {/* Architecture Overview */}
              <section className="animate-fade-in" style={{ animationDelay: '450ms' }}>
                <h2 className="font-mono text-xs sm:text-sm uppercase tracking-wider text-muted-foreground mb-3 sm:mb-4">
                  System Architecture
                </h2>
                <ArchitectureOverview />
              </section>
            </div>
            
            {/* Right Column - History Sidebar */}
            <div className="lg:col-span-1 animate-fade-in order-1 lg:order-2" style={{ animationDelay: '200ms' }}>
              <div className="lg:sticky lg:top-24">
                <h2 className="font-mono text-xs sm:text-sm uppercase tracking-wider text-muted-foreground mb-3 sm:mb-4">
                  Operation Log
                </h2>
                <HistorySidebar />
              </div>
            </div>
          </div>
          
          {/* Footer */}
          <footer className="text-center py-6 sm:py-8 border-t border-border/30">
            <p className="text-xs sm:text-sm text-muted-foreground">
              Built for <span className="text-primary font-mono">FastAPI</span> backend integration
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1 sm:mt-2">
              © 2024 StegAI • Deep Learning Steganography Platform
            </p>
          </footer>
        </div>
      </div>
    </div>
  );
};

export default Index;
