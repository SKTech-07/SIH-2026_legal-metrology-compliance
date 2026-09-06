import React, { useState } from 'react';
import { FileText, Check, Edit2, ShieldAlert } from 'lucide-react';
import type { Declaration } from '../types';

interface Props {
  declarations: Declaration[];
  onUpdateDeclaration: (id: string, value: string, status: string) => Promise<void>;
  onVerifyDeclaration: (id: string) => Promise<void>;
  canEdit: boolean;
}

export const DeclarationTable: React.FC<Props> = ({
  declarations,
  onUpdateDeclaration,
  onVerifyDeclaration,
  canEdit,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');

  const handleStartEdit = (d: Declaration) => {
    setEditingId(d.id);
    setEditValue(d.normalized_value || d.raw_text || '');
  };

  const handleSaveEdit = async (id: string) => {
    await onUpdateDeclaration(id, editValue, 'EDITS_ACCEPTED');
    setEditingId(null);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center space-x-2">
          <FileText className="w-5 h-5 text-amber-400" />
          <h4 className="text-xs font-bold text-slate-100 uppercase tracking-wide">
            Extracted Packaged Commodity Declarations
          </h4>
        </div>
        <span className="text-xs text-slate-400 font-mono">
          {declarations.length} Mandatory Items Detected
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-950 text-slate-400 uppercase font-bold text-[10px] tracking-wider border-b border-slate-800">
            <tr>
              <th className="py-2.5 px-3">Declaration Type</th>
              <th className="py-2.5 px-3">Detected Value / Text</th>
              <th className="py-2.5 px-3">Confidence</th>
              <th className="py-2.5 px-3">Status</th>
              <th className="py-2.5 px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {declarations.map((d) => (
              <tr key={d.id} className="hover:bg-slate-950/40">
                <td className="py-3 px-3 font-bold text-amber-400">
                  {d.declaration_type}
                </td>
                <td className="py-3 px-3 text-slate-200">
                  {editingId === d.id ? (
                    <input
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="w-full bg-slate-950 border border-amber-500 rounded px-2 py-1 text-xs font-mono text-white focus:outline-none"
                    />
                  ) : (
                    <span>{d.normalized_value || d.raw_text || '—'}</span>
                  )}
                </td>
                <td className="py-3 px-3 text-emerald-400 font-bold">
                  {Math.round(d.confidence * 100)}%
                </td>
                <td className="py-3 px-3">
                  <span className={`inline-block text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                    d.verification_status === 'VERIFIED'
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                      : d.verification_status === 'EDITS_ACCEPTED'
                      ? 'bg-blue-950 text-blue-300 border border-blue-700'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}>
                    {d.verification_status}
                  </span>
                </td>
                <td className="py-3 px-3 text-right">
                  {canEdit && (
                    <div className="flex items-center justify-end space-x-2">
                      {editingId === d.id ? (
                        <button
                          onClick={() => handleSaveEdit(d.id)}
                          className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] font-bold"
                        >
                          Save
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => handleStartEdit(d)}
                            className="p-1 text-slate-400 hover:text-amber-400"
                            title="Edit Value"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {d.verification_status !== 'VERIFIED' && (
                            <button
                              onClick={() => onVerifyDeclaration(d.id)}
                              className="px-2 py-1 bg-slate-800 hover:bg-emerald-950 text-emerald-400 border border-slate-700 hover:border-emerald-700 rounded text-[10px] font-bold"
                            >
                              Verify
                            </button>
                          )}
                        </>
                      )}
                    </div>
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
