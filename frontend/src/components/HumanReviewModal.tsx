import React, { useState } from 'react';
import { X, AlertTriangle, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import type { Violation } from '../types';

interface Props {
  violation: Violation | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmitReview: (violationId: string, action: 'CONFIRM' | 'REJECT' | 'REINSPECT', comment: string) => Promise<void>;
}

export const HumanReviewModal: React.FC<Props> = ({ violation, isOpen, onClose, onSubmitReview }) => {
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !violation) return null;

  const handleAction = async (action: 'CONFIRM' | 'REJECT' | 'REINSPECT') => {
    setIsSubmitting(true);
    try {
      await onSubmitReview(violation.id, action, comment);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-4 md:px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950 shrink-0">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wide truncate max-w-[200px] sm:max-w-sm">
              Human Review Action Required
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 p-1 shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 md:p-6 space-y-4 overflow-y-auto">
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
            <div className="text-xs font-bold text-amber-400 uppercase">
              Finding: {violation.violation_type}
            </div>
            <p className="text-xs text-slate-300 font-sans">
              {violation.description}
            </p>
            <div className="text-[11px] text-slate-500 font-mono">
              AI Confidence: {Math.round(violation.ai_confidence * 100)}%
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase mb-2">
              Inspector Review Notes & Justification
            </label>
            <textarea
              rows={4}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Enter remarks or justification for your decision..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-slate-200 focus:outline-none focus:border-amber-500 font-sans"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-4 md:px-6 py-4 bg-slate-950 border-t border-slate-800 flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-4 shrink-0">
          <button
            onClick={() => handleAction('REINSPECT')}
            disabled={isSubmitting}
            className="w-full sm:w-auto px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-bold rounded-lg border border-slate-700 flex items-center justify-center transition-colors"
          >
            <RefreshCw className="w-4 h-4 mr-1.5" /> Reinspection
          </button>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
            <button
              onClick={() => handleAction('REJECT')}
              disabled={isSubmitting}
              className="w-full sm:w-auto px-4 py-2.5 bg-slate-800 hover:bg-rose-950 text-rose-400 border border-slate-700 hover:border-rose-800 text-xs font-bold rounded-lg flex items-center justify-center transition-colors"
            >
              <XCircle className="w-4 h-4 mr-1.5" /> Reject Finding
            </button>

            <button
              onClick={() => handleAction('CONFIRM')}
              disabled={isSubmitting}
              className="w-full sm:w-auto px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-lg shadow-md flex items-center justify-center transition-colors"
            >
              <CheckCircle className="w-4 h-4 mr-1.5" /> Confirm Violation
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
