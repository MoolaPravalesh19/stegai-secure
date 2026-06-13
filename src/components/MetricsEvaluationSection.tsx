import React, { useEffect, useState } from 'react';
import { BarChart3, Loader2 } from 'lucide-react';
import GlassCard from './GlassCard';
import ImageUploader from './ImageUploader';
import { Button } from './ui/button';

interface Props {
  metrics: { psnr: number; mse: number; ssim: number; maxError: number } | null;
  recoveredImageUrl: string | null;
  hasOriginalRef: boolean;
}

type Metrics = { psnr: number; mse: number; ssim: number; maxError: number };

const fileToImageData = async (file: File, size: number): Promise<ImageData> => {
  const img = new Image();
  const url = URL.createObjectURL(file);
  await new Promise<void>((res, rej) => {
    img.onload = () => res();
    img.onerror = rej;
    img.src = url;
  });
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, size, size);
  URL.revokeObjectURL(url);
  return ctx.getImageData(0, 0, size, size);
};

const computeImageMetrics = (a: Uint8ClampedArray, b: Uint8ClampedArray): Metrics => {
  let sse = 0, count = 0, maxErr = 0, meanA = 0, meanB = 0;
  for (let i = 0; i < a.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const va = a[i + c], vb = b[i + c];
      const d = va - vb;
      sse += d * d;
      const ad = Math.abs(d);
      if (ad > maxErr) maxErr = ad;
      meanA += va; meanB += vb; count++;
    }
  }
  const mse = sse / count;
  const psnr = mse === 0 ? Infinity : 10 * Math.log10((255 * 255) / mse);
  meanA /= count; meanB /= count;
  let varA = 0, varB = 0, cov = 0;
  for (let i = 0; i < a.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const da = a[i + c] - meanA, db = b[i + c] - meanB;
      varA += da * da; varB += db * db; cov += da * db;
    }
  }
  varA /= count; varB /= count; cov /= count;
  const C1 = (0.01 * 255) ** 2, C2 = (0.03 * 255) ** 2;
  const ssim = ((2 * meanA * meanB + C1) * (2 * cov + C2)) /
    ((meanA * meanA + meanB * meanB + C1) * (varA + varB + C2));
  return { psnr, mse, ssim, maxError: maxErr };
};

const MetricsEvaluationSection: React.FC<Props> = ({ metrics, recoveredImageUrl }) => {
  const [imgA, setImgA] = useState<File | null>(null);
  const [imgB, setImgB] = useState<File | null>(null);
  const [standalone, setStandalone] = useState<Metrics | null>(null);
  const [computing, setComputing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effective = metrics ?? standalone;

  const handleCompute = async () => {
    if (!imgA || !imgB) return;
    setComputing(true);
    setError(null);
    try {
      const a = await fileToImageData(imgA, 256);
      const b = await fileToImageData(imgB, 256);
      setStandalone(computeImageMetrics(a.data, b.data));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to compute metrics');
    } finally {
      setComputing(false);
    }
  };

  useEffect(() => {
    if (metrics) setStandalone(null);
  }, [metrics]);

  return (
    <GlassCard className="transition-all duration-300">
      <div className="flex items-center gap-2 sm:gap-3 mb-4">
        <div className="p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-accent/10 border border-accent/20">
          <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6 text-accent" />
        </div>
        <div>
          <h2 className="font-mono font-bold text-lg sm:text-xl text-foreground">Metrics Evaluation</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Compare any two images, or auto-fill from the latest decode.
          </p>
        </div>
      </div>

      {!metrics && (
        <div className="space-y-3 mb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <ImageUploader label="Image A (Original)" onImageSelect={setImgA} />
            <ImageUploader label="Image B (Decrypted / Stego)" onImageSelect={setImgB} />
          </div>
          <Button
            variant="cyber"
            size="sm"
            className="w-full"
            onClick={handleCompute}
            disabled={!imgA || !imgB || computing}
          >
            {computing ? (
              <><Loader2 className="w-4 h-4 animate-spin mr-2" />Computing…</>
            ) : (
              <><BarChart3 className="w-4 h-4 mr-2" />Compute Metrics</>
            )}
          </Button>
          {error && <p className="text-xs text-destructive">{error}</p>}
          {recoveredImageUrl && (
            <p className="text-[11px] text-muted-foreground">
              Tip: decoding in neural mode with an original reference image will auto-populate metrics here.
            </p>
          )}
        </div>
      )}

      {effective ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">PSNR</p>
            <p className="font-mono text-sm sm:text-base text-foreground">
              {isFinite(effective.psnr) ? `${effective.psnr.toFixed(2)} dB` : '∞'}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">SSIM</p>
            <p className="font-mono text-sm sm:text-base text-foreground">{effective.ssim.toFixed(4)}</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">MSE</p>
            <p className="font-mono text-sm sm:text-base text-foreground">{effective.mse.toFixed(2)}</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Max Err</p>
            <p className="font-mono text-sm sm:text-base text-foreground">{effective.maxError}</p>
          </div>
        </div>
      ) : null}
    </GlassCard>
  );
};

export default MetricsEvaluationSection;