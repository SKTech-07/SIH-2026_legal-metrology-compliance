import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { 
  Plus, 
  Camera, 
  CheckCircle, 
  FileSpreadsheet, 
  ArrowLeft,
  Store,
  User as UserIcon,
  Package,
  AlertCircle
} from 'lucide-react';
import { api } from '../../services/api';
import type { Inspection, Product } from '../../types';
import { StatusBadge } from '../../components/StatusBadge';
import { ReportGeneratorModal } from '../../components/ReportGeneratorModal';
import { AddProductCaptureWizard } from '../../components/AddProductCaptureWizard';

export const InspectionWorkspacePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Add Product wizard state (replaces old form modal)
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  // Report Modal state
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  useEffect(() => {
    if (id) fetchInspectionWorkspace();
  }, [id]);

  const fetchInspectionWorkspace = async () => {
    try {
      setLoading(true);
      const [insRes, prodRes] = await Promise.all([
        api.get(`/inspections/${id}`),
        api.get(`/products/inspections/${id}/products`)
      ]);
      setInspection(insRes.data);
      setProducts(prodRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  /** Called by AddProductCaptureWizard after successful product creation + image upload */
  const handleWizardSuccess = (productId: string) => {
    setIsWizardOpen(false);
    fetchInspectionWorkspace();
    navigate(`/products/${productId}/capture`);
  };


  const handleAddCopy = async (productId: string) => {
    try {
      await api.post(`/products/${productId}/copies`);
      fetchInspectionWorkspace();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to add physical copy');
    }
  };

  const handleCompleteInspection = async () => {
    try {
      await api.post(`/inspections/${id}/complete`);
      fetchInspectionWorkspace();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Cannot complete inspection.');
    }
  };

  const handleGenerateReport = async (inspectionId: string, title: string, productIds: string[], format: 'PDF' | 'JSON' | 'CSV') => {
    const res = await api.post('/reports', {
      inspection_id: inspectionId,
      title,
      selected_product_ids: productIds,
      report_format: format
    });
    return res.data.file_url;
  };

  if (loading || !inspection) {
    return <div className="p-8 text-center text-gray-500">Loading inspection workspace...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <Link to="/inspections" className="p-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-lg transition-colors shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="min-w-0">
            <div className="flex items-center space-x-3">
              <h2 className="text-xl md:text-2xl font-bold text-gray-900 font-mono tracking-tight truncate">{inspection.code}</h2>
              <StatusBadge status={inspection.status} size="sm" />
            </div>
            <nav className="flex text-sm text-gray-500 mt-1 overflow-x-auto whitespace-nowrap scrollbar-none" aria-label="Breadcrumb">
              <ol className="inline-flex items-center space-x-1">
                <li className="inline-flex items-center">
                  <Link to="/dashboard" className="hover:text-gray-900 transition-colors">Home</Link>
                </li>
                <li>
                  <div className="flex items-center">
                    <span className="mx-1 md:mx-2 text-gray-400">/</span>
                    <Link to="/inspections" className="hover:text-gray-900 transition-colors">Inspections</Link>
                  </div>
                </li>
                <li>
                  <div className="flex items-center">
                    <span className="mx-1 md:mx-2 text-gray-400">/</span>
                    <span className="text-gray-900 font-medium truncate max-w-[100px] sm:max-w-xs">{inspection.code}</span>
                  </div>
                </li>
              </ol>
            </nav>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
          <button
            onClick={() => setIsReportModalOpen(true)}
            className="flex-1 sm:flex-none px-4 py-2.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-lg text-sm font-medium flex items-center justify-center space-x-2 transition-colors shadow-sm"
          >
            <FileSpreadsheet className="w-4 h-4 text-blue-600" />
            <span>Report</span>
          </button>

          {inspection.status !== 'COMPLETED' && (
            <button
              onClick={handleCompleteInspection}
              className="flex-1 sm:flex-none px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg shadow-sm flex items-center justify-center space-x-2 transition-colors"
            >
              <CheckCircle className="w-4 h-4" />
              <span>Complete Inspection</span>
            </button>
          )}
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
        <div className="bg-white border border-gray-200 rounded-xl p-4 md:p-5 shadow-sm">
          <div className="flex items-center space-x-2 text-sm font-bold text-gray-900 mb-3 border-b border-gray-100 pb-2">
            <Store className="w-4 h-4 text-gray-500" />
            <span>Store Information</span>
          </div>
          <p className="text-base font-semibold text-gray-900">{inspection.store_name}</p>
        </div>
        
        <div className="bg-white border border-gray-200 rounded-xl p-4 md:p-5 shadow-sm">
          <div className="flex items-center space-x-2 text-sm font-bold text-gray-900 mb-3 border-b border-gray-100 pb-2">
            <UserIcon className="w-4 h-4 text-gray-500" />
            <span>Inspector</span>
          </div>
          <p className="text-base font-semibold text-blue-600">{inspection.assigned_inspector_name || 'Unassigned'}</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4 md:p-5 shadow-sm sm:col-span-2 md:col-span-1">
          <div className="flex items-center space-x-2 text-sm font-bold text-gray-900 mb-3 border-b border-gray-100 pb-2">
            <AlertCircle className="w-4 h-4 text-gray-500" />
            <span>Inspection Details</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-500">Priority:</span>
            <span className={`font-semibold ${inspection.priority === 'HIGH' || inspection.priority === 'URGENT' ? 'text-rose-600' : 'text-gray-900'}`}>{inspection.priority}</span>
          </div>
        </div>
      </div>

      {/* Products Workspace List */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 md:p-5 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white">
          <div>
            <h3 className="text-lg font-bold text-gray-900 flex items-center">
              <Package className="w-5 h-5 mr-2 text-gray-400" />
              Products ({products.length})
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              Verify packaged commodities.
            </p>
          </div>
          <button
            onClick={() => setIsWizardOpen(true)}
            className="w-full sm:w-auto px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg shadow-sm flex items-center justify-center space-x-2 transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add Product</span>
          </button>
        </div>

        <div className="p-4 md:p-5 space-y-4 bg-gray-50/50">
          {products.map((p) => (
            <div
              key={p.id}
              className="bg-white border border-gray-200 rounded-xl p-4 md:p-5 hover:shadow-md transition-shadow flex flex-col lg:flex-row lg:items-center justify-between gap-6"
            >
              <div className="space-y-4 flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <h4 className="text-lg font-bold text-gray-900 leading-tight">{p.name}</h4>
                  <StatusBadge status={p.status} size="sm" />
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm text-gray-600">
                  <div className="bg-gray-50 px-3 py-2 rounded border border-gray-100">
                    <span className="text-gray-400 text-xs uppercase font-semibold block">Category</span>
                    <span className="font-medium text-gray-900 truncate block">{p.category}</span>
                  </div>
                  <div className="bg-gray-50 px-3 py-2 rounded border border-gray-100">
                    <span className="text-gray-400 text-xs uppercase font-semibold block">Brand</span>
                    <span className="font-medium text-gray-900 truncate block">{p.brand || 'N/A'}</span>
                  </div>
                  <div className="bg-gray-50 px-3 py-2 rounded border border-gray-100">
                    <span className="text-gray-400 text-xs uppercase font-semibold block">Barcode</span>
                    <span className="font-medium text-gray-900 font-mono truncate block">{p.barcode || 'N/A'}</span>
                  </div>
                </div>

                {/* Copies Counter Widget */}
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Copies ({p.copy_count}/5):</span>
                  <div className="flex items-center space-x-1.5">
                    {Array.from({ length: 5 }).map((_, idx) => (
                      <span
                        key={idx}
                        className={`w-7 h-7 sm:w-8 sm:h-8 rounded-md flex items-center justify-center text-xs font-bold transition-colors ${
                          idx < p.copy_count
                            ? 'bg-blue-100 text-blue-700 border border-blue-200 shadow-sm'
                            : 'bg-gray-50 text-gray-400 border border-gray-200'
                        }`}
                      >
                        {idx + 1}
                      </span>
                    ))}
                  </div>

                  {p.copy_count < 5 && (
                    <button
                      onClick={() => handleAddCopy(p.id)}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1.5 rounded transition-colors"
                    >
                      + Add Copy
                    </button>
                  )}
                </div>
              </div>

              {/* Action Button to Open 360 Capture Workflow */}
              <div className="shrink-0 pt-4 border-t border-gray-100 lg:pt-0 lg:border-t-0 lg:pl-6 lg:border-l">
                <Link
                  to={`/products/${p.id}/capture`}
                  className="w-full lg:w-auto px-5 py-3 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-sm font-semibold rounded-lg shadow-sm flex items-center justify-center space-x-2 transition-colors"
                >
                  <Camera className="w-5 h-5" />
                  <span>AI Verify</span>
                </Link>
              </div>
            </div>
          ))}
          
          {products.length === 0 && (
            <div className="py-12 px-4 text-center bg-white border border-gray-200 rounded-xl border-dashed">
              <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-gray-900">No Products Added</h3>
              <p className="text-gray-500 mt-1 max-w-sm mx-auto text-sm">Start by adding the packaged commodities that you need to inspect at this store.</p>
              <button
                onClick={() => setIsWizardOpen(true)}
                className="mt-6 w-full sm:w-auto px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg shadow-sm inline-flex items-center justify-center transition-colors"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add First Product
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Add Product Capture Wizard — replaces the old Add Product modal */}
      {id && (
        <AddProductCaptureWizard
          inspectionId={id}
          isOpen={isWizardOpen}
          onClose={() => setIsWizardOpen(false)}
          onSuccess={handleWizardSuccess}
        />
      )}

      {/* Report Modal */}
      <ReportGeneratorModal
        inspectionId={id!}
        products={products}
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        onGenerateReport={handleGenerateReport}
      />
    </div>
  );
};
