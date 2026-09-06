import React from 'react';
import { Cpu, CheckCircle2, Box } from 'lucide-react';

interface OCRItem {
  text: str;
  confidence: number;
  bbox: number[];
  language?: string;
  declaration_type?: string;
}

interface Props {
  modelName: string;
  processingTime: number;
  detections: OCRItem[];
}

export const OCRViewer: React.FC<Props> = ({ modelName, processingTime, detections }) => {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center space-x-2">
          <Cpu className="w-5 h-5 text-emerald-400" />
          <h4 className="text-xs font-bold text-slate-100 uppercase tracking-wide">
            AI Model Adapter & OCR Detection Output
          </h4>
        </div>
        <div className="text-[11px] font-mono text-slate-400">
          Model: <span className="text-amber-400 font-bold">{modelName}</span> | Latency: <span className="text-emerald-400 font-bold">{processingTime}s</span>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-xs font-bold text-slate-400 px-1">
          <span>Detected Text Bounding Boxes</span>
          <span>Confidence & Type</span>
        </div>

        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {detections.map((item, idx) => (
            <div
              key={idx}
              className="bg-slate-950 p-3 rounded-lg border border-slate-800 flex items-start justify-between hover:border-slate-700 transition-colors"
            >
              <div className="space-y-1 max-w-[70%]">
                <div className="text-xs font-mono text-slate-200 leading-snug">{item.text}</div>
                <div className="flex items-center space-x-2 text-[10px] text-slate-500 font-mono">
                  <span className="flex items-center"><Box className="w-3 h-3 mr-1" /> [{item.bbox.join(', ')}]</span>
                  <span>Lang: {item.language || 'en'}</span>
                </div>
              </div>

              <div className="text-right space-y-1">
                <span className="inline-block text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  {item.declaration_type || 'OCR REGION'}
                </span>
                <div className="text-xs font-mono font-bold text-emerald-400">
                  {Math.round(item.confidence * 100)}%
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
