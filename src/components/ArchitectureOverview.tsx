import React from 'react';
import { Code2, Database, Brain, Cloud, BarChart3 } from 'lucide-react';
import GlassCard from './GlassCard';

interface ArchitectureLayer {
  layer: string;
  technology: string;
  purpose: string;
  icon: React.ReactNode;
}

const architectureData: ArchitectureLayer[] = [
  {
    layer: 'Frontend',
    technology: 'React + Tailwind',
    purpose: 'User Dashboard aur Upload UI',
    icon: <Code2 className="w-4 h-4 text-primary" />
  },
  {
    layer: 'Backend API',
    technology: 'FastAPI / Flask',
    purpose: 'Python aur React ko connect karna',
    icon: <Database className="w-4 h-4 text-secondary" />
  },
  {
    layer: 'AI Model',
    technology: 'CNN (PyTorch/TF)',
    purpose: 'Image ke andar data hide/extract karna',
    icon: <Brain className="w-4 h-4 text-cyber-green" />
  },
  {
    layer: 'Storage',
    technology: 'Supabase Storage',
    purpose: 'Images ko cloud par save karna',
    icon: <Cloud className="w-4 h-4 text-cyber-pink" />
  },
  {
    layer: 'Metrics',
    technology: 'NumPy / Scikit-Image',
    purpose: 'PSNR aur SSIM calculate karna',
    icon: <BarChart3 className="w-4 h-4 text-primary" />
  }
];

const ArchitectureOverview: React.FC = () => {
  return (
    <GlassCard>
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-primary/10">
          <Code2 className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="font-mono font-semibold text-foreground">Project Architecture Overview</h3>
          <p className="text-xs text-muted-foreground">System layers and technologies</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border/50">
              <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground uppercase tracking-wider">Layer</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground uppercase tracking-wider">Technology</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground uppercase tracking-wider">Purpose</th>
            </tr>
          </thead>
          <tbody>
            {architectureData.map((item, index) => (
              <tr 
                key={item.layer}
                className="border-b border-border/30 hover:bg-muted/20 transition-colors"
              >
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    {item.icon}
                    <span className="font-mono font-medium text-foreground">{item.layer}</span>
                  </div>
                </td>
                <td className="py-3 px-4">
                  <span className="text-sm text-muted-foreground">{item.technology}</span>
                </td>
                <td className="py-3 px-4">
                  <span className="text-sm text-muted-foreground">{item.purpose}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </GlassCard>
  );
};

export default ArchitectureOverview;
