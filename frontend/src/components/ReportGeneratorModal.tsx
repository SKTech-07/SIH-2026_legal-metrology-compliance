import React, { useState } from 'react';
import { X, FileSpreadsheet, Download, CheckSquare, Square } from 'lucide-react';
import type { Product } from '../types';
import { getBaseUrl } from '../services/api';

interface Props {
  inspectionId: string;
  products: Product[];
  isOpen: boolean;
  onClose: () => void;
  onGenerateReport: (inspectionId: string, title: string, productIds: string[], format: 'PDF' | 'JSON' | 'CSV') => Promise<string>;
}

export const ReportGeneratorModal: React.FC<Props> = ({
  inspectionId,
  products,
  isOpen,
  onClose,
  onGenerateReport,
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>(products.map((p) => p.id));
  const [reportTitle, setReportTitle] = useState('Official Legal Metrology Compliance Report');
  const [format, setFormat] = useState<'PDF' | 'JSON' | 'CSV'>('PDF');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);

  if (!isOpen) return null;

  const toggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const selectAll = () => {
    setSelectedIds(products.map((p) => p.id));
  };

  const handleGenerate = async () => {
    if (selectedIds.length === 0) return;
    setIsGenerating(true);
    try {
      const url = await onGenerateReport(inspectionId, reportTitle, selectedIds, format);
      setGeneratedUrl(url);
    } catch (err) {
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-4 md:px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950 shrink-0">
          <div className="flex items-center space-x-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
            <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wide truncate max-w-[200px] sm:max-w-sm">
              Generate Inspection Compliance Report
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 p-1 shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 md:p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
              Report Title
            </label>
            <input
              type="text"
              value={reportTitle}
              onChange={(e) => setReportTitle(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm md:text-xs text-slate-100 font-sans focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Format Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase mb-2">
              Export Format
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(['PDF', 'JSON', 'CSV'] as const).map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => setFormat(fmt)}
                  className={`py-2.5 text-xs font-black rounded-xl border transition-all ${
                    format === fmt
                      ? 'bg-emerald-600 text-white border-emerald-500 shadow-md'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-800'
                  }`}
                >
                  {fmt} Document
                </button>
              ))}
            </div>
          </div>

          {/* Product Subset Selection */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-semibold text-slate-300 uppercase">
                Select Product Subset for Report ({selectedIds.length} / {products.length} Selected)
              </label>
              <button onClick={selectAll} className="text-[11px] text-amber-400 hover:underline shrink-0">
                Select All Products
              </button>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {products.map((p) => {
                const isSelected = selectedIds.includes(p.id);
                return (
                  <div
                    key={p.id}
                    onClick={() => toggleSelect(p.id)}
                    className={`p-3 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-slate-950 border-emerald-500/50 text-slate-100'
                        : 'bg-slate-950/40 border-slate-800 text-slate-500 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start sm:items-center space-x-3">
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-emerald-400 mt-1 sm:mt-0 shrink-0" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-600 mt-1 sm:mt-0 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <div className="text-xs font-bold truncate">{p.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono truncate">Category: {p.category} | Barcode: {p.barcode || 'N/A'}</div>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold uppercase font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 shrink-0 self-start sm:self-auto">
                      {p.status}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {generatedUrl && (
            <div className="p-4 bg-emerald-950/70 border border-emerald-700 text-emerald-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="text-xs font-bold">Report Generated Successfully!</div>
                <div className="text-[11px] text-emerald-300 font-mono">{format} report is ready for download.</div>
              </div>
              <a
                href={`${getBaseUrl()}${generatedUrl}`}
                target="_blank"
                rel="noreferrer"
                className="w-full sm:w-auto px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black uppercase tracking-wider rounded-lg shadow-md flex items-center justify-center transition-colors"
              >
                <Download className="w-4 h-4 mr-1.5" /> Download File
              </a>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 md:px-6 py-4 bg-slate-950 border-t border-slate-800 flex flex-col-reverse sm:flex-row sm:justify-end gap-3 shrink-0">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-lg border border-slate-700 transition-colors"
          >
            Close
          </button>
          <button
            onClick={handleGenerate}
            disabled={isGenerating || selectedIds.length === 0}
            className="w-full sm:w-auto px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow-md disabled:opacity-50 flex items-center justify-center transition-colors"
          >
            {isGenerating ? 'Generating...' : `Generate ${format} Report`}
          </button>
        </div>
      </div>
    </div>
  );
};
