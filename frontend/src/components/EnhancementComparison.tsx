import React from 'react';
import { Layers, ArrowRight, Sparkles } from 'lucide-react';

interface Props {
  originalUrl: string;
  enhancedUrl: string;
  operations: string[];
  qualityBefore: number;
  qualityAfter: number;
  ocrConfBefore: number;
  ocrConfAfter: number;
}

export const EnhancementComparison: React.FC<Props> = ({
  originalUrl,
  enhancedUrl,
  operations,
  qualityBefore,
  qualityAfter,
  ocrConfBefore,
  ocrConfAfter,
}) => {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center space-x-2">
          <Sparkles className="w-5 h-5 text-indigo-400" />
          <h4 className="text-xs font-bold text-slate-100 uppercase tracking-wide">
            Adaptive Image Enhancement (Side-by-Side)
          </h4>
        </div>
        <span className="text-[11px] font-bold bg-indigo-950 text-indigo-300 border border-indigo-700 px-2.5 py-1 rounded-md">
          {operations.length} OpenCV Filters Applied
        </span>
      </div>

      {/* Applied Operations Tags */}
      <div className="flex flex-wrap gap-1.5">
        {operations.map((op, idx) => (
          <span key={idx} className="bg-slate-950 text-slate-300 text-[10px] font-bold px-2 py-0.5 rounded border border-slate-800">
            ✓ {op}
          </span>
        ))}
      </div>

      {/* Side-by-Side Images */}
      <div className="grid grid-cols-2 gap-4">
        {/* Original */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs font-bold text-slate-400">
            <span>ORIGINAL IMAGE</span>
            <span className="text-slate-500">Quality: {qualityBefore}</span>
          </div>
          <div className="aspect-video bg-black rounded-lg overflow-hidden border border-slate-800">
            <img src={originalUrl} alt="Original" className="w-full h-full object-contain" />
          </div>
          <div className="text-[11px] text-slate-500 text-center font-mono">
            Baseline OCR Conf: {Math.round(ocrConfBefore * 100)}%
          </div>
        </div>

        {/* Enhanced */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs font-bold text-indigo-300">
            <span>ENHANCED IMAGE</span>
            <span className="text-emerald-400 font-black">Quality: {qualityAfter} (▲ +{(qualityAfter - qualityBefore).toFixed(1)})</span>
          </div>
          <div className="aspect-video bg-black rounded-lg overflow-hidden border border-indigo-500/40 shadow-lg">
            <img src={enhancedUrl} alt="Enhanced" className="w-full h-full object-contain" />
          </div>
          <div className="text-[11px] text-emerald-400 text-center font-mono font-bold">
            Boosted OCR Conf: {Math.round(ocrConfAfter * 100)}% (▲ +{Math.round((ocrConfAfter - ocrConfBefore) * 100)}%)
          </div>
        </div>
      </div>
    </div>
  );
};
