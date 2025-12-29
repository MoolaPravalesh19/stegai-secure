import React, { useState } from 'react';
import GlassCard from './GlassCard';
import { Layers, ArrowLeftRight } from 'lucide-react';

interface ComparisonSliderProps {
  originalImage?: string;
  stegoImage?: string;
}

const ComparisonSlider: React.FC<ComparisonSliderProps> = ({ 
  originalImage = 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=400&h=300&fit=crop',
  stegoImage = 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=400&h=300&fit=crop&sat=-100'
}) => {
  const [sliderPosition, setSliderPosition] = useState(50);
  const [showDifference, setShowDifference] = useState(false);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSliderPosition(Number(e.target.value));
  };

  return (
    <GlassCard>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Layers className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-mono font-semibold text-foreground">Visual Comparison</h3>
            <p className="text-xs text-muted-foreground">Original vs Stego Image</p>
          </div>
        </div>
        
        <button
          onClick={() => setShowDifference(!showDifference)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            showDifference 
              ? 'bg-primary text-primary-foreground' 
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
        >
          {showDifference ? 'Hide' : 'Show'} Difference Map
        </button>
      </div>
      
      <div className="relative aspect-video rounded-xl overflow-hidden border border-border/50 bg-muted/30">
        {showDifference ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div 
              className="w-full h-full"
              style={{
                background: 'repeating-linear-gradient(45deg, hsl(var(--primary) / 0.1), hsl(var(--primary) / 0.1) 10px, transparent 10px, transparent 20px)',
              }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center p-6 rounded-xl bg-background/80 backdrop-blur-sm">
                <p className="font-mono text-primary text-lg mb-1">Δ 0.02%</p>
                <p className="text-xs text-muted-foreground">Imperceptible difference</p>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Original Image (Background) */}
            <img 
              src={originalImage}
              alt="Original"
              className="absolute inset-0 w-full h-full object-cover"
            />
            
            {/* Stego Image (Foreground with clip) */}
            <div 
              className="absolute inset-0 overflow-hidden"
              style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
            >
              <img 
                src={stegoImage}
                alt="Stego"
                className="w-full h-full object-cover"
              />
            </div>
            
            {/* Slider Handle */}
            <div 
              className="absolute top-0 bottom-0 w-1 bg-primary cursor-ew-resize"
              style={{ left: `${sliderPosition}%`, transform: 'translateX(-50%)' }}
            >
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/30">
                <ArrowLeftRight className="w-5 h-5 text-primary-foreground" />
              </div>
            </div>
            
            {/* Labels */}
            <div className="absolute top-3 left-3 px-2 py-1 rounded-md bg-background/80 backdrop-blur-sm text-xs font-mono">
              Original
            </div>
            <div className="absolute top-3 right-3 px-2 py-1 rounded-md bg-background/80 backdrop-blur-sm text-xs font-mono">
              Stego
            </div>
          </>
        )}
      </div>
      
      {!showDifference && (
        <input
          type="range"
          min="0"
          max="100"
          value={sliderPosition}
          onChange={handleSliderChange}
          className="w-full mt-4 accent-primary"
        />
      )}
    </GlassCard>
  );
};

export default ComparisonSlider;
