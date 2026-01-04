import React, { useEffect, useRef, useState } from 'react';
import { GitCompare, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { analyzeImageHistogram, HistogramData } from './ImageHistogram';

interface ComparisonHistogramProps {
  beforeImage: File | null;
  afterImage: File | null;
  beforeLabel?: string;
  afterLabel?: string;
}

const ComparisonHistogram: React.FC<ComparisonHistogramProps> = ({
  beforeImage,
  afterImage,
  beforeLabel = "Cover Image",
  afterLabel = "Stego Image"
}) => {
  const beforeCanvasRef = useRef<HTMLCanvasElement>(null);
  const afterCanvasRef = useRef<HTMLCanvasElement>(null);
  const diffCanvasRef = useRef<HTMLCanvasElement>(null);
  
  const [beforeData, setBeforeData] = useState<HistogramData | null>(null);
  const [afterData, setAfterData] = useState<HistogramData | null>(null);
  const [diffStats, setDiffStats] = useState<{
    totalDiff: number;
    maxDiff: number;
    avgDiff: number;
  } | null>(null);

  useEffect(() => {
    if (beforeImage) {
      analyzeImageHistogram(beforeImage).then(setBeforeData);
    } else {
      setBeforeData(null);
    }
  }, [beforeImage]);

  useEffect(() => {
    if (afterImage) {
      analyzeImageHistogram(afterImage).then(setAfterData);
    } else {
      setAfterData(null);
    }
  }, [afterImage]);

  const drawHistogram = (
    canvas: HTMLCanvasElement | null,
    data: HistogramData | null,
    isDiff: boolean = false
  ) => {
    if (!canvas || !data) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    const maxValue = Math.max(
      ...data.red.map(Math.abs),
      ...data.green.map(Math.abs),
      ...data.blue.map(Math.abs)
    );

    if (maxValue === 0) return;

    const barWidth = width / 256;

    const drawChannel = (channelData: number[], color: string, negColor?: string) => {
      ctx.beginPath();
      
      if (isDiff) {
        // For difference view, draw from center
        const centerY = height / 2;
        ctx.moveTo(0, centerY);
        
        for (let i = 0; i < 256; i++) {
          const barHeight = (channelData[i] / maxValue) * (height / 2);
          const x = i * barWidth;
          ctx.lineTo(x, centerY - barHeight);
        }
        
        ctx.lineTo(width, centerY);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
      } else {
        ctx.moveTo(0, height);
        
        for (let i = 0; i < 256; i++) {
          const barHeight = (channelData[i] / maxValue) * height;
          const x = i * barWidth;
          ctx.lineTo(x, height - barHeight);
        }
        
        ctx.lineTo(width, height);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
      }
    };

    if (isDiff) {
      drawChannel(data.red, 'rgba(239, 68, 68, 0.6)');
      drawChannel(data.green, 'rgba(34, 197, 94, 0.6)');
      drawChannel(data.blue, 'rgba(59, 130, 246, 0.6)');
      
      // Draw center line
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();
    } else {
      drawChannel(data.red, 'rgba(239, 68, 68, 0.5)');
      drawChannel(data.green, 'rgba(34, 197, 94, 0.5)');
      drawChannel(data.blue, 'rgba(59, 130, 246, 0.5)');
    }
  };

  useEffect(() => {
    drawHistogram(beforeCanvasRef.current, beforeData);
  }, [beforeData]);

  useEffect(() => {
    drawHistogram(afterCanvasRef.current, afterData);
  }, [afterData]);

  useEffect(() => {
    if (!beforeData || !afterData) {
      setDiffStats(null);
      return;
    }

    // Calculate difference
    const diffData: HistogramData = {
      red: beforeData.red.map((v, i) => afterData.red[i] - v),
      green: beforeData.green.map((v, i) => afterData.green[i] - v),
      blue: beforeData.blue.map((v, i) => afterData.blue[i] - v),
    };

    drawHistogram(diffCanvasRef.current, diffData, true);

    // Calculate stats
    const allDiffs = [...diffData.red, ...diffData.green, ...diffData.blue].map(Math.abs);
    const totalDiff = allDiffs.reduce((a, b) => a + b, 0);
    const maxDiff = Math.max(...allDiffs);
    const avgDiff = totalDiff / allDiffs.length;

    setDiffStats({ totalDiff, maxDiff, avgDiff });
  }, [beforeData, afterData]);

  if (!beforeImage && !afterImage) return null;

  return (
    <div className="p-4 rounded-xl bg-muted/30 border border-border/50 space-y-4">
      <div className="flex items-center gap-2">
        <GitCompare className="w-4 h-4 text-primary" />
        <span className="text-sm font-medium text-muted-foreground">Histogram Comparison</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Before Histogram */}
        <div className="space-y-2">
          <span className="text-xs font-medium text-muted-foreground">{beforeLabel}</span>
          <div className="relative">
            <canvas
              ref={beforeCanvasRef}
              width={256}
              height={80}
              className="w-full h-20 rounded-lg bg-background/50"
            />
            {!beforeImage && (
              <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
                No image
              </div>
            )}
          </div>
        </div>

        {/* After Histogram */}
        <div className="space-y-2">
          <span className="text-xs font-medium text-muted-foreground">{afterLabel}</span>
          <div className="relative">
            <canvas
              ref={afterCanvasRef}
              width={256}
              height={80}
              className="w-full h-20 rounded-lg bg-background/50"
            />
            {!afterImage && (
              <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
                No image
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Difference Histogram */}
      {beforeData && afterData && (
        <div className="space-y-2 pt-2 border-t border-border/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Difference Map</span>
            {diffStats && (
              <div className="flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1">
                  {diffStats.avgDiff < 10 ? (
                    <Minus className="w-3 h-3 text-green-500" />
                  ) : diffStats.avgDiff < 100 ? (
                    <TrendingUp className="w-3 h-3 text-yellow-500" />
                  ) : (
                    <TrendingDown className="w-3 h-3 text-red-500" />
                  )}
                  <span className="text-muted-foreground">
                    Avg: {diffStats.avgDiff.toFixed(1)}
                  </span>
                </div>
                <span className="text-muted-foreground">
                  Max: {diffStats.maxDiff.toLocaleString()}
                </span>
              </div>
            )}
          </div>
          <div className="relative">
            <canvas
              ref={diffCanvasRef}
              width={256}
              height={80}
              className="w-full h-20 rounded-lg bg-background/50"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background/20 to-transparent rounded-lg pointer-events-none" />
          </div>
          <p className="text-xs text-muted-foreground/70 text-center">
            Values above center = more pixels after encoding • Below = fewer pixels
          </p>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500/70" />
          <span className="text-muted-foreground">Red</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-green-500/70" />
          <span className="text-muted-foreground">Green</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-blue-500/70" />
          <span className="text-muted-foreground">Blue</span>
        </div>
      </div>
    </div>
  );
};

export default ComparisonHistogram;
