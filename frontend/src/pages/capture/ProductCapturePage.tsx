import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  Camera, 
  Cpu, 
  ArrowLeft, 
  AlertTriangle,
  Package,
  Image as ImageIcon
} from 'lucide-react';
import { api } from '../../services/api';
import type { Product, ProductCopy, ImageRecord, ImageQuality, Declaration, ComplianceResult, Violation, PackageSide } from '../../types';
import { CameraCaptureModal } from '../../components/CameraCaptureModal';
import { QualityScoreWidget } from '../../components/QualityScoreWidget';
import { EnhancementComparison } from '../../components/EnhancementComparison';
import { OCRViewer } from '../../components/OCRViewer';
import { DeclarationTable } from '../../components/DeclarationTable';
import { ComplianceChecklist } from '../../components/ComplianceChecklist';
import { EvidenceViewerModal } from '../../components/EvidenceViewerModal';
import { HumanReviewModal } from '../../components/HumanReviewModal';
import { StatusBadge } from '../../components/StatusBadge';

export const ProductCapturePage: React.FC = () => {
  const { id } = useParams<{ id: string }>(); // product_id
  const [product, setProduct] = useState<Product | null>(null);
  const [activeCopy, setActiveCopy] = useState<ProductCopy | null>(null);
  const [images, setImages] = useState<ImageRecord[]>([]);
  const [selectedImage, setSelectedImage] = useState<ImageRecord | null>(null);
  const [quality, setQuality] = useState<ImageQuality | null>(null);
  const [enhancement, setEnhancement] = useState<any>(null);
  const [aiData, setAiData] = useState<any>(null);
  const [declarations, setDeclarations] = useState<Declaration[]>([]);
  const [complianceResults, setComplianceResults] = useState<ComplianceResult[]>([]);
  const [violations, setViolations] = useState<Violation[]>([]);

  // Modals
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [selectedEvidence, setSelectedEvidence] = useState<Violation | null>(null);
  const [selectedReviewViolation, setSelectedReviewViolation] = useState<Violation | null>(null);

  // Loading states
  const [loading, setLoading] = useState(true);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [isAIProcessing, setIsAIProcessing] = useState(false);
  const [isEvaluatingRules, setIsEvaluatingRules] = useState(false);

  useEffect(() => {
    if (id) fetchProductDetails();
  }, [id]);

  const fetchProductDetails = async () => {
    try {
      setLoading(true);
      const prodRes = await api.get(`/products/${id}`);
      setProduct(prodRes.data);
      if (prodRes.data.copies && prodRes.data.copies.length > 0) {
        setActiveCopy(prodRes.data.copies[0]);
        fetchCopyImages(prodRes.data.copies[0].id);
      }
      fetchDeclarations();
      fetchCompliance();
      fetchViolations();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCopyImages = async (copyId: string) => {
    try {
      await api.get(`/copies/${copyId}`);
      // Mock images attached if any
    } catch (err) {
      console.error(err);
    }
  };

  const fetchDeclarations = async () => {
    try {
      const res = await api.get(`/declarations/products/${id}`);
      setDeclarations(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchCompliance = async () => {
    try {
      const res = await api.get(`/compliance/products/${id}`);
      setComplianceResults(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchViolations = async () => {
    try {
      const res = await api.get('/violations');
      setViolations(res.data.filter((v: Violation) => v.product_id === id));
    } catch (err) {
      console.error(err);
    }
  };

  const handleApiUpload = async (copyId: string, side: PackageSide, file: File) => {
    const formData = new FormData();
    formData.append('side', side);
    formData.append('file', file);
    const res = await api.post(`/images/copies/${copyId}/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    setSelectedImage(res.data);
    setImages([...images, res.data]);
    handleAnalyzeQuality(res.data.id);
  };

  const handleAnalyzeQuality = async (imageId: string) => {
    try {
      const res = await api.post(`/quality/images/${imageId}/analyze`);
      setQuality(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleRunEnhancement = async () => {
    if (!selectedImage) return;
    setIsEnhancing(true);
    try {
      const res = await api.post(`/enhancement/images/${selectedImage.id}/enhance`);
      setEnhancement(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleTriggerAI = async () => {
    if (!selectedImage) return;
    setIsAIProcessing(true);
    try {
      const res = await api.post(`/ocr/images/${selectedImage.id}/process`);
      setAiData(res.data);
      fetchDeclarations();
    } catch (err) {
      console.error(err);
    } finally {
      setIsAIProcessing(false);
    }
  };

  const handleRunCompliance = async () => {
    setIsEvaluatingRules(true);
    try {
      const res = await api.post(`/compliance/products/${id}/evaluate`);
      setComplianceResults(res.data);
      fetchProductDetails();
      fetchViolations();
    } catch (err) {
      console.error(err);
    } finally {
      setIsEvaluatingRules(false);
    }
  };

  const handleUpdateDeclaration = async (declId: string, value: string, status: string) => {
    await api.put(`/declarations/${declId}`, {
      normalized_value: value,
      verification_status: status
    });
    fetchDeclarations();
  };

  const handleVerifyDeclaration = async (declId: string) => {
    await api.post(`/declarations/${declId}/verify`);
    fetchDeclarations();
  };

  const handleSubmitReview = async (violationId: string, action: 'CONFIRM' | 'REJECT' | 'REINSPECT', comment: string) => {
    if (action === 'CONFIRM') {
      await api.post(`/violations/${violationId}/confirm`, { action: 'CONFIRM', comment });
    } else if (action === 'REJECT') {
      await api.post(`/violations/${violationId}/reject`, { action: 'REJECT', comment });
    } else {
      await api.post(`/violations/${violationId}/reinspect`, { action: 'REINSPECT', comment });
    }
    fetchProductDetails();
    fetchViolations();
  };

  if (loading || !product) {
    return <div className="p-8 text-center text-gray-500">Loading AI Inspection Studio...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 pb-4">
        <div className="flex items-center space-x-3 md:space-x-4">
          <Link to={`/inspections/${product.inspection_id}`} className="p-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-lg transition-colors shadow-sm shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="min-w-0">
            <div className="flex items-center space-x-3">
              <h2 className="text-xl md:text-2xl font-bold text-gray-900 tracking-tight truncate">{product.name}</h2>
              <StatusBadge status={product.status} size="sm" />
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500 mt-1">
              <span className="flex items-center"><Package className="w-4 h-4 mr-1.5" /> Category: <strong className="text-gray-900 ml-1">{product.category}</strong></span>
              <span className="flex items-center border-l border-gray-300 pl-4">Barcode: <strong className="text-gray-900 ml-1 font-mono">{product.barcode || 'N/A'}</strong></span>
            </div>
          </div>
        </div>

        {/* Quick Stepper Action Buttons */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto shrink-0">
          <button
            onClick={() => setIsCameraModalOpen(true)}
            className="flex-1 sm:flex-none px-4 py-2.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 font-semibold rounded-lg shadow-sm flex items-center justify-center space-x-2 transition-colors"
          >
            <Camera className="w-5 h-5" />
            <span>Capture Side</span>
          </button>

          {selectedImage && (
            <button
              onClick={handleTriggerAI}
              disabled={isAIProcessing}
              className="flex-1 sm:flex-none px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-sm flex items-center justify-center space-x-2 disabled:opacity-50 transition-colors"
            >
              <Cpu className="w-5 h-5" />
              <span>{isAIProcessing ? 'Analyzing...' : 'AI Scan'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Grid: Left Column (Capture & OpenCV Enhancement), Right Column (OCR & Declarations & Rules) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Image Management & Quality */}
        <div className="lg:col-span-5 space-y-6">
          {/* Active Image Box */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 md:p-5 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide flex items-center">
                <ImageIcon className="w-4 h-4 mr-2 text-gray-500" />
                Image Viewer
              </h3>
              <span className="text-[10px] font-bold font-mono uppercase bg-blue-50 text-blue-700 px-2.5 py-1 rounded-md border border-blue-100">
                {selectedImage ? `SIDE: ${selectedImage.side}` : 'NO IMAGE'}
              </span>
            </div>

            <div className="aspect-[4/3] sm:aspect-video lg:aspect-square bg-gray-50 rounded-lg overflow-hidden border border-gray-200 relative flex items-center justify-center shadow-inner w-full">
              {selectedImage ? (
                <img
                  src={`http://localhost:8000${selectedImage.original_url}`}
                  alt="Package Side"
                  className="w-full h-full object-contain p-2"
                />
              ) : (
                <div className="text-center space-y-3 p-6 max-w-[200px]">
                  <div className="w-16 h-16 bg-white border border-gray-200 rounded-full flex items-center justify-center mx-auto shadow-sm">
                    <Camera className="w-8 h-8 text-gray-400" />
                  </div>
                  <p className="text-sm text-gray-500">Capture a package side to begin AI analysis.</p>
                </div>
              )}
            </div>

            {/* Captured Side Thumbnails */}
            {images.length > 0 && (
              <div className="flex items-center space-x-2 overflow-x-auto pb-2 pt-1 scrollbar-none snap-x">
                {images.map((img) => (
                  <button
                    key={img.id}
                    onClick={() => { setSelectedImage(img); handleAnalyzeQuality(img.id); }}
                    className={`px-4 py-2.5 rounded-lg text-xs font-semibold font-mono border transition-colors whitespace-nowrap snap-start ${
                      selectedImage?.id === img.id
                        ? 'bg-blue-50 text-blue-700 border-blue-200 shadow-sm'
                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {img.side}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* OpenCV Quality Widget */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <QualityScoreWidget
              quality={quality}
              onRunEnhancement={handleRunEnhancement}
              isEnhancing={isEnhancing}
            />
          </div>

          {/* Enhancement Side-by-Side if available */}
          {enhancement && selectedImage && (
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <EnhancementComparison
                originalUrl={`http://localhost:8000${selectedImage.original_url}`}
                enhancedUrl={`http://localhost:8000${enhancement.enhanced_url}`}
                operations={enhancement.applied_operations}
                qualityBefore={enhancement.quality_before}
                qualityAfter={enhancement.quality_after}
                ocrConfBefore={enhancement.ocr_confidence_before}
                ocrConfAfter={enhancement.ocr_confidence_after}
              />
            </div>
          )}
        </div>

        {/* Right Column: OCR, Declarations, Rule Engine & Human Review */}
        <div className="lg:col-span-7 space-y-6">
          {/* AI OCR Detections */}
          {aiData && (
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <OCRViewer
                modelName={aiData.model_name}
                processingTime={aiData.processing_time}
                detections={aiData.detections}
              />
            </div>
          )}

          {/* Declarations Editor Table */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <DeclarationTable
              declarations={declarations}
              onUpdateDeclaration={handleUpdateDeclaration}
              onVerifyDeclaration={handleVerifyDeclaration}
              canEdit={true}
            />
          </div>

          {/* Legal Metrology Compliance Rule Engine */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <ComplianceChecklist
              results={complianceResults}
              onViewEvidence={(ruleCode) => {
                const v = violations.find((item) => item.rule_code === ruleCode);
                if (v) setSelectedEvidence(v);
              }}
              onEvaluateCompliance={handleRunCompliance}
              isEvaluating={isEvaluatingRules}
            />
          </div>

          {/* Violations & Human Review Banner */}
          {violations.length > 0 && (
            <div className="bg-white border border-rose-200 rounded-xl shadow-sm overflow-hidden mb-8 md:mb-0">
              <div className="bg-rose-50 border-b border-rose-100 p-4 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="w-5 h-5 text-rose-600" />
                  <h4 className="text-sm font-bold text-rose-900 uppercase tracking-wide">
                    Flagged Violations ({violations.length})
                  </h4>
                </div>
              </div>

              <div className="p-4 space-y-3">
                {violations.map((v) => (
                  <div key={v.id} className="bg-white p-4 rounded-lg border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-gray-300 transition-colors">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-gray-900">{v.violation_type}</span>
                        <span className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{v.rule_code}</span>
                      </div>
                      <div className="text-sm text-gray-600 mt-1">{v.description}</div>
                    </div>
                    <button
                      onClick={() => setSelectedReviewViolation(v)}
                      className="w-full sm:w-auto px-4 py-2.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-semibold rounded-lg shadow-sm whitespace-nowrap transition-colors"
                    >
                      Human Review
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {activeCopy && (
        <CameraCaptureModal
          copyId={activeCopy.id}
          isOpen={isCameraModalOpen}
          onClose={() => setIsCameraModalOpen(false)}
          onImageUploaded={() => fetchProductDetails()}
          apiUpload={handleApiUpload}
        />
      )}

      <EvidenceViewerModal
        violation={selectedEvidence}
        isOpen={!!selectedEvidence}
        onClose={() => setSelectedEvidence(null)}
      />

      <HumanReviewModal
        violation={selectedReviewViolation}
        isOpen={!!selectedReviewViolation}
        onClose={() => setSelectedReviewViolation(null)}
        onSubmitReview={handleSubmitReview}
      />
    </div>
  );
};
