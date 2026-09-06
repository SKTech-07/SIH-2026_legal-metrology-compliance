import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  AlertOctagon, 
  Search, 
  Filter, 
  Download,
  AlertTriangle,
  AlertCircle,
  Eye,
  FileText
} from 'lucide-react';
import { api } from '../../services/api';
import type { Violation } from '../../types';
import { EvidenceViewerModal } from '../../components/EvidenceViewerModal';
import { HumanReviewModal } from '../../components/HumanReviewModal';
import { StatusBadge } from '../../components/StatusBadge';

export const ViolationsEvidencePage: React.FC = () => {
  const [violations, setViolations] = useState<Violation[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedEvidence, setSelectedEvidence] = useState<Violation | null>(null);
  const [selectedReview, setSelectedReview] = useState<Violation | null>(null);

  useEffect(() => {
    fetchViolations();
  }, []);

  const fetchViolations = async () => {
    try {
      setLoading(true);
      const res = await api.get('/violations');
      setViolations(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitReview = async (violationId: string, action: 'CONFIRM' | 'REJECT' | 'REINSPECT', comment: string) => {
    try {
      if (action === 'CONFIRM') {
        await api.post(`/violations/${violationId}/confirm`, { action: 'CONFIRM', comment });
      } else if (action === 'REJECT') {
        await api.post(`/violations/${violationId}/reject`, { action: 'REJECT', comment });
      } else {
        await api.post(`/violations/${violationId}/reinspect`, { action: 'REINSPECT', comment });
      }
      fetchViolations();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <nav className="flex mb-2" aria-label="Breadcrumb">
            <ol className="inline-flex items-center space-x-1 md:space-x-3">
              <li className="inline-flex items-center">
                <Link to="/" className="text-gray-500 hover:text-gray-900 inline-flex items-center">
                  Home
                </Link>
              </li>
              <li>
                <div className="flex items-center">
                  <span className="mx-2 text-gray-400">/</span>
                  <span className="text-gray-900 font-medium">Violations</span>
                </div>
              </li>
            </ol>
          </nav>
          <h1 className="text-2xl font-bold text-gray-900">
            Violations & Evidence
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Review and manage all non-compliance issues identified during inspections.
          </p>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm flex flex-col">
        <div className="p-5 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white">
          <h3 className="text-lg font-bold text-gray-900 flex items-center">
            <AlertOctagon className="w-5 h-5 mr-2 text-rose-500" />
            Violations Registry
          </h3>
          
          <div className="relative w-full sm:w-72">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search product or rule code..."
              className="block w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white transition-colors"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50 text-gray-500 uppercase text-xs font-semibold border-b border-gray-200">
              <tr>
                <th className="py-3 px-5">Product</th>
                <th className="py-3 px-5">Rule Code</th>
                <th className="py-3 px-5">Violation Type</th>
                <th className="py-3 px-5">Severity</th>
                <th className="py-3 px-5">Status</th>
                <th className="py-3 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {violations.map((v) => (
                <tr key={v.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="py-3 px-5 font-medium text-gray-900">
                    {v.product_name || 'Commodity'}
                  </td>
                  <td className="py-3 px-5 font-medium text-gray-600 font-mono text-xs">
                    {v.rule_code || 'LM-RULE'}
                  </td>
                  <td className="py-3 px-5 text-gray-600">
                    <span className="flex items-center max-w-[200px] truncate" title={v.violation_type}>
                      <AlertCircle className="w-3.5 h-3.5 mr-1.5 text-gray-400 shrink-0" />
                      <span className="truncate">{v.violation_type}</span>
                    </span>
                  </td>
                  <td className="py-3 px-5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      v.severity === 'HIGH' || v.severity === 'CRITICAL' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {v.severity}
                    </span>
                  </td>
                  <td className="py-3 px-5">
                    <StatusBadge status={v.status} size="sm" />
                  </td>
                  <td className="py-3 px-5 text-right">
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={() => setSelectedEvidence(v)}
                        className="px-3 py-1.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-md font-medium text-xs inline-flex items-center transition-colors shadow-sm"
                      >
                        <Eye className="w-3.5 h-3.5 mr-1.5 text-gray-500" /> Evidence
                      </button>
                      <button
                        onClick={() => setSelectedReview(v)}
                        className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-md font-medium text-xs inline-flex items-center transition-colors shadow-sm"
                      >
                        <FileText className="w-3.5 h-3.5 mr-1.5" /> Review
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {violations.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-500">
                    <AlertOctagon className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm font-medium">No violations recorded.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <EvidenceViewerModal
        violation={selectedEvidence}
        isOpen={!!selectedEvidence}
        onClose={() => setSelectedEvidence(null)}
      />

      <HumanReviewModal
        violation={selectedReview}
        isOpen={!!selectedReview}
        onClose={() => setSelectedReview(null)}
        onSubmitReview={handleSubmitReview}
      />
    </div>
  );
};

