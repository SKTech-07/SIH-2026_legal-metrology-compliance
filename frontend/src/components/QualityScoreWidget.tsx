import React from 'react';
import { Eye, Zap, ShieldCheck } from 'lucide-react';
import type { ImageQuality } from '../types';
import { StatusBadge } from './StatusBadge';

interface Props {
  quality: ImageQuality | null;
  onRunEnhancement?: () => void;
  isEnhancing?: boolean;
}

export const QualityScoreWidget: React.FC<Props> = ({ quality, onRunEnhancement, isEnhancing }) => {
  if (!quality) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center">
        <p className="text-xs text-slate-400">Quality analysis pending.</p>
      </div>
    );
  }

  const metrics = [
    { label: 'Blur Sharpness', value: `${quality.blur}`, pct: Math.min(100, quality.blur / 4) },
    { label: 'Brightness', value: `${quality.brightness}`, pct: Math.min(100, (quality.brightness / 255) * 100) },
    { label: 'Contrast StdDev', value: `${quality.contrast}`, pct: Math.min(100, (quality.contrast / 100) * 100) },
    { label: 'Glare Overexposure', value: `${quality.glare}%`, pct: Math.max(0, 100 - quality.glare * 5) },
    { label: 'Noise Score', value: `${quality.noise}`, pct: Math.max(0, 100 - quality.noise * 5) },
    { label: 'Text Visibility', value: `${quality.text_visibility}%`, pct: quality.text_visibility },
  ];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center space-x-2">
          <Eye className="w-5 h-5 text-amber-400" />
          <h4 className="text-xs font-bold text-slate-100 uppercase tracking-wide">
            OpenCV Image Quality Analysis
          </h4>
        </div>
        <StatusBadge status={quality.status} size="sm" />
      </div>

      {/* Overall Score Gauge */}
      <div className="bg-slate-950 p-4 rounded-lg flex items-center justify-between border border-slate-800">
        <div>
          <div className="text-[11px] font-bold text-slate-400 uppercase">Overall Clarity Index</div>
          <div className="text-2xl font-black text-amber-400 mt-0.5">
            {quality.overall_quality} <span className="text-xs text-slate-500 font-normal">/ 100</span>
          </div>
        </div>

        {quality.status !== 'GOOD' && onRunEnhancement && (
          <button
            onClick={onRunEnhancement}
            disabled={isEnhancing}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg shadow-md flex items-center space-x-1.5 transition-all disabled:opacity-50"
          >
            <Zap className="w-4 h-4 text-amber-300" />
            <span>{isEnhancing ? 'Enhancing...' : 'Apply Adaptive Enhancement'}</span>
          </button>
        )}
      </div>

      {/* Metric Progress Bars */}
      <div className="grid grid-cols-2 gap-3 text-xs">
        {metrics.map((m) => (
          <div key={m.label} className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
            <div className="flex justify-between text-[11px] font-semibold text-slate-300 mb-1">
              <span>{m.label}</span>
              <span className="text-amber-400 font-mono">{m.value}</span>
            </div>
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.max(5, Math.min(100, m.pct))}%` }}
              ></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
