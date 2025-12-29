import React from 'react';
import { Activity, Timer, BarChart3, Zap } from 'lucide-react';
import CyberGrid from '@/components/CyberGrid';
import HeroSection from '@/components/HeroSection';
import WorkspacePanel from '@/components/WorkspacePanel';
import MetricCard from '@/components/MetricCard';
import ComparisonSlider from '@/components/ComparisonSlider';
import HistorySidebar from '@/components/HistorySidebar';

const Index: React.FC = () => {
  return (
    <div className="min-h-screen relative">
      <CyberGrid />
      
      <div className="relative z-10 flex">
        {/* Main Content */}
        <div className="flex-1 p-6 lg:p-10">
          <div className="max-w-6xl mx-auto">
            {/* Hero Section */}
            <HeroSection />
            
            {/* Metrics Dashboard */}
            <section className="mb-10">
              <h2 className="font-mono text-sm uppercase tracking-wider text-muted-foreground mb-4">
                Performance Metrics
              </h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                  label="PSNR Value"
                  value="42.5"
                  unit="dB"
                  icon={<Activity className="w-5 h-5" />}
                  color="cyan"
                  progress={85}
                />
                <MetricCard
                  label="SSIM Score"
                  value="0.98"
                  icon={<BarChart3 className="w-5 h-5" />}
                  color="purple"
                  progress={98}
                />
                <MetricCard
                  label="Encoding Time"
                  value="1.2"
                  unit="sec"
                  icon={<Timer className="w-5 h-5" />}
                  color="green"
                  progress={40}
                />
                <MetricCard
                  label="Capacity"
                  value="2.4"
                  unit="bpp"
                  icon={<Zap className="w-5 h-5" />}
                  color="pink"
                  progress={60}
                />
              </div>
            </section>
            
            {/* Workspace Panels */}
            <section className="mb-10">
              <h2 className="font-mono text-sm uppercase tracking-wider text-muted-foreground mb-4">
                Workspace
              </h2>
              <WorkspacePanel />
            </section>
            
            {/* Visual Comparison */}
            <section className="mb-10">
              <ComparisonSlider />
            </section>
            
            {/* Footer */}
            <footer className="text-center py-8 border-t border-border/30">
              <p className="text-sm text-muted-foreground">
                Built for <span className="text-primary font-mono">FastAPI</span> backend integration
              </p>
              <p className="text-xs text-muted-foreground/60 mt-2">
                © 2024 StegAI • Deep Learning Steganography Platform
              </p>
            </footer>
          </div>
        </div>
        
        {/* History Sidebar */}
        <aside className="hidden xl:block w-80 p-6 border-l border-border/30">
          <HistorySidebar />
        </aside>
      </div>
    </div>
  );
};

export default Index;
