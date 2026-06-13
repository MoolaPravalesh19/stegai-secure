import React from 'react';
import { BarChart3 } from 'lucide-react';
import GlassCard from './GlassCard';

interface Props {
  metrics: { psnr: number; mse: number; ssim: number; maxError: number } | null;
  recoveredImageUrl: string | null;
  hasOriginalRef: boolean;
}

const MetricsEvaluationSection: React.FC<Props> = ({ metrics, recoveredImageUrl, hasOriginalRef }) => {
  return (
    <GlassCard className="transition-all duration-300">
      <div className="flex items-center gap-2 sm:gap-3 mb-4">
        <div className="p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-accent/10 border border-accent/20">
          <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6 text-accent" />
        </div>
        <div>
          <h2 className="font-mono font-bold text-lg sm:text-xl text-foreground">Metrics Evaluation</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Quality comparison between the original cover image and the decrypted output.
          </p>
        </div>
      </div>

      {!recoveredImageUrl ? (
        <p className="text-xs sm:text-sm text-muted-foreground">
          Decode a stego image in neural mode to see quality metrics here.
        </p>
      ) : metrics ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">PSNR</p>
            <p className="font-mono text-sm sm:text-base text-foreground">
              {isFinite(metrics.psnr) ? `${metrics.psnr.toFixed(2)} dB` : '∞'}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">SSIM</p>
            <p className="font-mono text-sm sm:text-base text-foreground">{metrics.ssim.toFixed(4)}</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">MSE</p>
            <p className="font-mono text-sm sm:text-base text-foreground">{metrics.mse.toFixed(2)}</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Max Err</p>
            <p className="font-mono text-sm sm:text-base text-foreground">{metrics.maxError}</p>
          </div>
        </div>
      ) : (
        <p className="text-xs sm:text-sm text-muted-foreground">
          {hasOriginalRef
            ? 'Computing metrics…'
            : 'Upload the original image in the Decode tab to compute PSNR / SSIM / MSE between the original and decrypted image.'}
        </p>
      )}
    </GlassCard>
  );
};

export default MetricsEvaluationSection;