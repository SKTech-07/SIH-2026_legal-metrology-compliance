import React from 'react';
import { CheckCircle2, XCircle, AlertTriangle, RefreshCw, MinusCircle } from 'lucide-react';
import type { ComplianceStatus } from '../types';

interface Props {
  status: ComplianceStatus | string;
  size?: 'sm' | 'md' | 'lg';
}

export const StatusBadge: React.FC<Props> = ({ status, size = 'md' }) => {
  const statusUpper = status.toUpperCase();

  const getStyle = () => {
    switch (statusUpper) {
      case 'PASS':
      case 'GOOD':
      case 'COMPLETED':
        return {
          bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          icon: <CheckCircle2 className="w-4 h-4 mr-1 text-emerald-600" />,
          label: '✓ PASS',
        };
      case 'FAIL':
      case 'POOR':
        return {
          bg: 'bg-rose-50 text-rose-700 border-rose-200',
          icon: <XCircle className="w-4 h-4 mr-1 text-rose-600" />,
          label: '✗ FAIL',
        };
      case 'REVIEW':
      case 'PENDING':
        return {
          bg: 'bg-amber-50 text-amber-800 border-amber-300',
          icon: <AlertTriangle className="w-4 h-4 mr-1 text-amber-600" />,
          label: '⚠ REVIEW',
        };
      case 'PROCESSING':
      case 'IN_PROGRESS':
        return {
          bg: 'bg-blue-50 text-blue-700 border-blue-200',
          icon: <RefreshCw className="w-4 h-4 mr-1 text-blue-600 animate-spin" />,
          label: '○ PROCESSING',
        };
      default:
        return {
          bg: 'bg-slate-100 text-slate-700 border-slate-300',
          icon: <MinusCircle className="w-4 h-4 mr-1 text-slate-500" />,
          label: `— ${statusUpper}`,
        };
    }
  };

  const style = getStyle();
  const px = size === 'sm' ? 'px-2 py-0.5 text-xs' : size === 'lg' ? 'px-3 py-1.5 text-sm font-bold' : 'px-2.5 py-1 text-xs font-semibold';

  return (
    <span className={`inline-flex items-center rounded-md border ${style.bg} ${px} font-sans uppercase tracking-wide shadow-xs`}>
      {style.icon}
      {style.label}
    </span>
  );
};
