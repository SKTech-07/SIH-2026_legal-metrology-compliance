import React from 'react';
import { X, ShieldAlert, FileText, CheckCircle2 } from 'lucide-react';
import type { Violation } from '../types';

interface Props {
  violation: Violation | null;
  isOpen: boolean;
  onClose: () => void;
}

export const EvidenceViewerModal: React.FC<Props> = ({ violation, isOpen, onClose }) => {
  if (!isOpen || !violation) return null;

  const ev = violation.evidence[0];
  const imageUrl = ev?.annotated_image_url || '/api/v1/images/file/sample_evidence.jpg';

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-4 md:px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950 shrink-0">
          <div className="flex items-center space-x-2">
            <ShieldAlert className="w-5 h-5 text-rose-400" />
            <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wide truncate max-w-[200px] sm:max-w-md">
              Violation Evidence Inspector — Rule #{violation.rule_code || 'LM-RULE'}
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 p-1 shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 md:p-6 space-y-4 overflow-y-auto">
          {/* Annotated Image */}
          <div className="aspect-video bg-black rounded-xl overflow-hidden border border-rose-900/60 shadow-lg relative flex items-center justify-center">
            <img src={imageUrl} alt="Annotated Evidence" className="w-full h-full object-contain" />
            <div className="absolute top-2 left-2 md:top-3 md:left-3 bg-rose-950/90 border border-rose-700 text-rose-200 px-2 py-1 md:px-3 rounded-md text-[10px] md:text-xs font-bold font-mono">
              ANNOTATED BOUNDING BOX EVIDENCE
            </div>
          </div>

          {/* Details Metadata */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
              <div className="text-slate-400 uppercase text-[10px] font-bold">Violation Details</div>
              <div className="text-slate-200"><span className="text-amber-400">Type:</span> {violation.violation_type}</div>
              <div className="text-slate-200"><span className="text-amber-400">Severity:</span> {violation.severity}</div>
              <div className="text-slate-200"><span className="text-amber-400">Status:</span> {violation.status}</div>
              <div className="text-slate-200"><span className="text-amber-400">AI Confidence:</span> {Math.round(violation.ai_confidence * 100)}%</div>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
              <div className="text-slate-400 uppercase text-[10px] font-bold">Regulatory Finding</div>
              <p className="text-slate-300 font-sans text-xs leading-relaxed">
                {violation.description}
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 md:px-6 py-4 bg-slate-950 border-t border-slate-800 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg border border-slate-700 transition-colors"
          >
            Close Evidence Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
