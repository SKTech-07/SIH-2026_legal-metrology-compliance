import React from 'react';
import { Scale, Eye, AlertOctagon } from 'lucide-react';
import type { ComplianceResult } from '../types';
import { StatusBadge } from './StatusBadge';

interface Props {
  results: ComplianceResult[];
  onViewEvidence?: (ruleCode: string) => void;
  onEvaluateCompliance: () => void;
  isEvaluating?: boolean;
}

export const ComplianceChecklist: React.FC<Props> = ({
  results,
  onViewEvidence,
  onEvaluateCompliance,
  isEvaluating,
}) => {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center space-x-2">
          <Scale className="w-5 h-5 text-amber-400" />
          <h4 className="text-xs font-bold text-slate-100 uppercase tracking-wide">
            Legal Metrology Rule Compliance Validation
          </h4>
        </div>
        <button
          onClick={onEvaluateCompliance}
          disabled={isEvaluating}
          className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black uppercase tracking-wider rounded-lg shadow-md transition-all disabled:opacity-50"
        >
          {isEvaluating ? 'Evaluating Rules...' : 'Run Compliance Engine'}
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-950 text-slate-400 uppercase font-bold text-[10px] tracking-wider border-b border-slate-800">
            <tr>
              <th className="py-2.5 px-3">Rule Code</th>
              <th className="py-2.5 px-3">Rule Name & Requirement</th>
              <th className="py-2.5 px-3">Detected Value</th>
              <th className="py-2.5 px-3">Result</th>
              <th className="py-2.5 px-3 text-right">Evidence</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {results.map((r) => (
              <tr key={r.id} className="hover:bg-slate-950/40">
                <td className="py-3 px-3 font-bold text-amber-400">
                  {r.rule_code || 'LM-RULE'}
                </td>
                <td className="py-3 px-3">
                  <div className="font-bold text-slate-200">{r.rule_name || 'Legal Metrology Standard'}</div>
                  <div className="text-[11px] text-slate-400 font-sans">{r.expected_value}</div>
                </td>
                <td className="py-3 px-3 text-slate-300">
                  {r.detected_value || '—'}
                </td>
                <td className="py-3 px-3">
                  <StatusBadge status={r.status} size="sm" />
                </td>
                <td className="py-3 px-3 text-right">
                  {(r.status === 'FAIL' || r.status === 'REVIEW') && onViewEvidence && (
                    <button
                      onClick={() => onViewEvidence(r.rule_code || '')}
                      className="px-2.5 py-1 bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-800 rounded text-[10px] font-bold inline-flex items-center"
                    >
                      <Eye className="w-3 h-3 mr-1" /> View Evidence
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
