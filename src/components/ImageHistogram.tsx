import React, { useEffect, useRef, useState } from 'react';
import { BarChart3 } from 'lucide-react';

interface ImageHistogramProps {
  imageFile: File | null;
  label?: string;
}

const ImageHistogram: React.FC<ImageHistogramProps> = ({ imageFile, label = "Histogram Analysis" }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [histogramData, setHistogramData] = useState<{
    red: number[];
    green: number[];
    blue: number[];
  } | null>(null);

  useEffect(() => {
    if (!imageFile) {
      setHistogramData(null);
      return;
    }

    const analyzeImage = async () => {
      const img = new Image();
      const url = URL.createObjectURL(imageFile);
      
      img.onload = () => {
        // Create offscreen canvas to analyze image
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // Initialize histogram arrays
        const red = new Array(256).fill(0);
        const green = new Array(256).fill(0);
        const blue = new Array(256).fill(0);

        // Count pixel values
        for (let i = 0; i < data.length; i += 4) {
          red[data[i]]++;
          green[data[i + 1]]++;
          blue[data[i + 2]]++;
        }

        setHistogramData({ red, green, blue });
        URL.revokeObjectURL(url);
      };

      img.src = url;
    };

    analyzeImage();
  }, [imageFile]);

  useEffect(() => {
    if (!histogramData || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Find max value for normalization
    const maxValue = Math.max(
      ...histogramData.red,
      ...histogramData.green,
      ...histogramData.blue
    );

    const barWidth = width / 256;

    // Draw histograms with transparency
    const drawChannel = (data: number[], color: string) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, height);
      
      for (let i = 0; i < 256; i++) {
        const barHeight = (data[i] / maxValue) * height;
        const x = i * barWidth;
        ctx.lineTo(x, height - barHeight);
      }
      
      ctx.lineTo(width, height);
      ctx.closePath();
      ctx.fill();
    };

    // Draw each channel with transparency for overlap visibility
    drawChannel(histogramData.red, 'rgba(239, 68, 68, 0.5)');
    drawChannel(histogramData.green, 'rgba(34, 197, 94, 0.5)');
    drawChannel(histogramData.blue, 'rgba(59, 130, 246, 0.5)');

  }, [histogramData]);

  if (!imageFile) return null;

  return (
    <div className="p-4 rounded-xl bg-muted/30 border border-border/50 space-y-3">
      <div className="flex items-center gap-2">
        <BarChart3 className="w-4 h-4 text-primary" />
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
      </div>
      
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={256}
          height={100}
          className="w-full h-24 rounded-lg bg-background/50"
        />
        
        {/* Gradient overlay for aesthetics */}
        <div className="absolute inset-0 bg-gradient-to-t from-background/20 to-transparent rounded-lg pointer-events-none" />
      </div>

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

export default ImageHistogram;
