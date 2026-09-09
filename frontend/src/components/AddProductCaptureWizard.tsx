import React, { useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Camera,
  X,
  Check,
  SkipForward,
  RefreshCw,
  Upload,
  ChevronRight,
  AlertTriangle,
  Ban,
} from 'lucide-react';
import { api } from '../services/api';
import type { PackageSide } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────

type SideStatus = 'PENDING' | 'CAPTURED' | 'SKIPPED';

interface SideState {
  status: SideStatus;
  file: File | null;
  previewUrl: string | null;
}

type WizardStage = 'CAPTURE' | 'REVIEW' | 'DETAILS';

// ─── Side definitions (fixed order per spec) ──────────────────────────────────

interface SideDef {
  key: PackageSide;
  label: string;
  shortLabel: string;
}

const SIDE_DEFS: SideDef[] = [
  { key: 'FRONT',  label: 'FRONT',         shortLabel: 'Front'  },
  { key: 'BACK',   label: 'BACK',          shortLabel: 'Back'   },
  { key: 'LEFT',   label: 'LEFT',          shortLabel: 'Left'   },
  { key: 'RIGHT',  label: 'RIGHT',         shortLabel: 'Right'  },
  { key: 'TOP',    label: 'TOP / UP',      shortLabel: 'Top'    },
  { key: 'BOTTOM', label: 'BOTTOM / DOWN', shortLabel: 'Bottom' },
];

const TOTAL_SIDES = SIDE_DEFS.length; // 6



// ─── Initial blank state ──────────────────────────────────────────────────────

const buildInitialSides = (): Record<PackageSide, SideState> =>
  Object.fromEntries(
    SIDE_DEFS.map(({ key }) => [key, { status: 'PENDING', file: null, previewUrl: null }])
  ) as Record<PackageSide, SideState>;

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  inspectionId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (productId: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const AddProductCaptureWizard: React.FC<Props> = ({
  inspectionId,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const navigate = useNavigate();

  // ── Stage ─────────────────────────────────────────────────────────────────
  const [stage, setStage] = useState<WizardStage>('CAPTURE');

  // ── Capture stage: current side index (0–5) ───────────────────────────────
  const [currentSideIdx, setCurrentSideIdx] = useState<number>(0);

  // ── Per-side state ────────────────────────────────────────────────────────
  const [sides, setSides] = useState<Record<PackageSide, SideState>>(buildInitialSides);

  // ── Review mode: which side is being re-captured from review ──────────────
  const [reviewCapturingSide, setReviewCapturingSide] = useState<PackageSide | null>(null);

  // ── Product details form ──────────────────────────────────────────────────
  const [prodName, setProdName] = useState('');
  const [prodCategory, setProdCategory] = useState('Food');
  const [prodBrand, setProdBrand] = useState('');
  const [prodBarcode, setProdBarcode] = useState('');

  // ── Submission state ──────────────────────────────────────────────────────
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // ── Review capture target
  const reviewTargetSideRef = useRef<PackageSide | null>(null);

  // ─── Derived ──────────────────────────────────────────────────────────────

  const currentSideDef = SIDE_DEFS[currentSideIdx];
  const currentSideKey = currentSideDef?.key;

  // ─── Helpers ──────────────────────────────────────────────────────────────

  const revokeUrl = (url: string | null) => {
    if (url) URL.revokeObjectURL(url);
  };

  const resetWizard = useCallback(() => {
    setSides((prev) => {
      SIDE_DEFS.forEach(({ key }) => revokeUrl(prev[key].previewUrl));
      return buildInitialSides();
    });
    setStage('CAPTURE');
    setCurrentSideIdx(0);
    setReviewCapturingSide(null);
    reviewTargetSideRef.current = null;
    setProdName('');
    setProdCategory('Food');
    setProdBrand('');
    setProdBarcode('');
    setSubmitError(null);
    setIsSubmitting(false);
  }, []);

  const handleClose = useCallback(() => {
    resetWizard();
    onClose();
  }, [resetWizard, onClose]);

  // ─── Capture stage ────────────────────────────────────────────────────────

  const advanceToNext = useCallback((fromIdx: number) => {
    const nextIdx = fromIdx + 1;
    if (nextIdx >= TOTAL_SIDES) {
      setStage('REVIEW');
    } else {
      setCurrentSideIdx(nextIdx);
    }
  }, []);

  const applyFileToCurrentSide = useCallback(
    (file: File) => {
      if (!currentSideKey) return;
      setSides((prev) => {
        revokeUrl(prev[currentSideKey].previewUrl);
        return {
          ...prev,
          [currentSideKey]: {
            status: 'CAPTURED',
            file,
            previewUrl: URL.createObjectURL(file),
          },
        };
      });
    },
    [currentSideKey]
  );

  const handleCameraChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) applyFileToCurrentSide(file);
      e.target.value = '';
    },
    [applyFileToCurrentSide]
  );

  const handleGalleryChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) applyFileToCurrentSide(file);
      e.target.value = '';
    },
    [applyFileToCurrentSide]
  );



  const handleSkipSide = useCallback(() => {
    if (!currentSideKey) return;
    setSides((prev) => {
      revokeUrl(prev[currentSideKey].previewUrl);
      return { ...prev, [currentSideKey]: { status: 'SKIPPED', file: null, previewUrl: null } };
    });
    advanceToNext(currentSideIdx);
  }, [currentSideKey, currentSideIdx, advanceToNext]);

  const handleContinueSide = useCallback(() => {
    advanceToNext(currentSideIdx);
  }, [advanceToNext, currentSideIdx]);

  // ─── Review stage ─────────────────────────────────────────────────────────

  const handleReviewCameraChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      const targetSide = reviewTargetSideRef.current || reviewCapturingSide;
      if (!file || !targetSide) return;
      setSides((prev) => {
        revokeUrl(prev[targetSide].previewUrl);
        return {
          ...prev,
          [targetSide]: {
            status: 'CAPTURED',
            file,
            previewUrl: URL.createObjectURL(file),
          },
        };
      });
      setReviewCapturingSide(null);
      e.target.value = '';
    },
    [reviewCapturingSide]
  );

  const handleReviewGalleryChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      const targetSide = reviewTargetSideRef.current || reviewCapturingSide;
      if (!file || !targetSide) return;
      setSides((prev) => {
        revokeUrl(prev[targetSide].previewUrl);
        return {
          ...prev,
          [targetSide]: {
            status: 'CAPTURED',
            file,
            previewUrl: URL.createObjectURL(file),
          },
        };
      });
      setReviewCapturingSide(null);
      e.target.value = '';
    },
    [reviewCapturingSide]
  );

  const markReviewTargetSide = (key: PackageSide) => {
    reviewTargetSideRef.current = key;
    setReviewCapturingSide(key);
  };

  const handleReviewContinue = useCallback(() => setStage('DETAILS'), []);

  // ─── Details submission ───────────────────────────────────────────────────

  const handleSubmitDetails = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setSubmitError(null);
      setIsSubmitting(true);
      try {
        // 1. Create product
        const prodRes = await api.post(`/products/inspections/${inspectionId}/products`, {
          name: prodName,
          category: prodCategory,
          brand: prodBrand,
          barcode: prodBarcode,
        });
        const productId: string = prodRes.data.id;

        // 2. Create first copy
        const copyRes = await api.post(`/products/${productId}/copies`);
        const copyId: string = copyRes.data.id;

        // 3. Upload only captured sides (in defined order)
        for (const { key } of SIDE_DEFS) {
          const s = sides[key];
          if (s.status !== 'CAPTURED' || !s.file) continue;
          const formData = new FormData();
          formData.append('side', key);
          formData.append(
            'file',
            new File([s.file], `package_${key}.jpg`, { type: s.file.type || 'image/jpeg' })
          );
          await api.post(`/images/copies/${copyId}/upload`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
        }

        // 4. Done
        resetWizard();
        onSuccess(productId);
        navigate(`/products/${productId}/capture`);
      } catch (err: any) {
        setSubmitError(
          err?.response?.data?.detail || err?.message || 'An error occurred. Please try again.'
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [inspectionId, prodName, prodCategory, prodBrand, prodBarcode, sides, resetWizard, onSuccess, navigate]
  );

  // ─── Guard ────────────────────────────────────────────────────────────────

  if (!isOpen) return null;

  // ─── Shared header ────────────────────────────────────────────────────────

  const renderHeader = (title: string, subtitle?: string) => (
    <div className="px-4 md:px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-white shrink-0">
      <div className="min-w-0">
        <h3 className="text-base font-bold text-gray-900 truncate">{title}</h3>
        {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      <button
        type="button"
        onClick={handleClose}
        aria-label="Close wizard"
        className="ml-3 shrink-0 text-gray-400 hover:text-gray-600 p-1 rounded transition-colors"
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  );

  // ─── Progress dots + bar (CAPTURE stage) ──────────────────────────────────

  const renderProgress = () => (
    <div className="px-4 md:px-6 pt-4 pb-2 shrink-0">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          SIDE {currentSideIdx + 1} OF {TOTAL_SIDES}
        </span>
        <div className="flex gap-1.5 items-center">
          {SIDE_DEFS.map(({ key }, idx) => {
            const s = sides[key];
            let cls = 'w-2 h-2 rounded-full transition-all duration-200 ';
            if (idx < currentSideIdx) {
              cls += s.status === 'CAPTURED' ? 'bg-emerald-500' : 'bg-gray-300';
            } else if (idx === currentSideIdx) {
              cls += 'bg-blue-500 w-2.5 h-2.5 ring-2 ring-blue-200';
            } else {
              cls += 'bg-gray-200';
            }
            return <span key={key} className={cls} />;
          })}
        </div>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-500 rounded-full transition-all duration-300"
          style={{ width: `${(currentSideIdx / TOTAL_SIDES) * 100}%` }}
        />
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // STAGE: CAPTURE
  // ═══════════════════════════════════════════════════════════════════════════

  if (stage === 'CAPTURE') {
    const sideDef = SIDE_DEFS[currentSideIdx];
    const sideState = sides[sideDef.key];

    return (
      <div className="fixed inset-0 z-50 bg-gray-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 pb-16 sm:pb-4">
        <div className="bg-white border border-gray-200 rounded-t-2xl sm:rounded-xl w-full sm:max-w-md flex flex-col shadow-2xl max-h-[calc(92svh-4rem)] sm:max-h-[95vh] overflow-hidden overflow-x-hidden">
          {renderHeader('Capture Product Sides', 'Photograph each side of the product')}
          {renderProgress()}

          <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-5 space-y-4 pb-4">
            {/* Side name */}
            <div className="text-center pt-1">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                Position {currentSideIdx + 1} of {TOTAL_SIDES}
              </p>
              <h2 className="text-2xl font-black text-gray-900 tracking-tight">{sideDef.label}</h2>
            </div>

            {/* ── PENDING ──────────────────────────────────────────────────── */}
            {sideState.status === 'PENDING' && (
              <div className="space-y-3">
                <div className="aspect-[4/3] sm:aspect-video bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-center p-4 sm:p-6">
                  <Camera className="w-8 h-8 sm:w-10 sm:h-10 text-gray-300 mb-2 sm:mb-3" />
                  <p className="text-sm text-gray-500 font-medium">
                    Capture the <span className="font-bold text-gray-700">{sideDef.label}</span>
                  </p>
                  <p className="text-xs text-gray-400 mt-1">or skip if this side doesn't exist</p>
                </div>

                <label className="cursor-pointer w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-sm flex items-center justify-center gap-2 transition-colors text-sm active:scale-95">
                  <Camera className="w-4 h-4" />
                  <span>Capture Side</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handleCameraChange}
                  />
                </label>

                <label className="cursor-pointer w-full py-2.5 bg-white hover:bg-gray-50 text-gray-700 font-medium rounded-xl border border-gray-200 flex items-center justify-center gap-2 transition-colors text-sm active:scale-95">
                  <Upload className="w-4 h-4" />
                  <span>Upload Image</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleGalleryChange}
                  />
                </label>

                <button
                  type="button"
                  onClick={handleSkipSide}
                  className="w-full py-2.5 bg-white hover:bg-gray-50 text-gray-500 font-medium rounded-xl border border-gray-200 flex items-center justify-center gap-2 transition-colors text-sm active:scale-95"
                >
                  <SkipForward className="w-4 h-4" />
                  Skip Side
                </button>
              </div>
            )}

            {/* ── CAPTURED ─────────────────────────────────────────────────── */}
            {sideState.status === 'CAPTURED' && sideState.previewUrl && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-emerald-600 justify-center">
                  <span className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center">
                    <Check className="w-4 h-4" />
                  </span>
                  <span className="font-semibold text-sm">{sideDef.label} Captured</span>
                </div>

                <div className="aspect-[4/3] sm:aspect-video bg-black rounded-xl overflow-hidden border border-gray-200 shadow-sm">
                  <img
                    src={sideState.previewUrl}
                    alt={`${sideDef.label} preview`}
                    className="w-full h-full object-contain"
                  />
                </div>

                <div className="flex gap-2.5">
                  <label className="cursor-pointer flex-1 py-2.5 bg-white hover:bg-gray-50 text-gray-600 font-medium rounded-xl border border-gray-200 flex items-center justify-center gap-2 transition-colors text-sm">
                    <RefreshCw className="w-4 h-4" />
                    <span>Retake</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={handleCameraChange}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={handleContinueSide}
                    className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors text-sm active:scale-95"
                  >
                    Continue
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* ── SKIPPED ──────────────────────────────────────────────────── */}
            {sideState.status === 'SKIPPED' && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-gray-400 justify-center">
                  <span className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center">
                    <Ban className="w-4 h-4" />
                  </span>
                  <span className="font-semibold text-sm">{sideDef.label} Skipped</span>
                </div>

                <div className="aspect-[4/3] sm:aspect-video bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-center p-4 sm:p-6">
                  <Ban className="w-8 h-8 sm:w-10 sm:h-10 text-gray-200 mb-2 sm:mb-3" />
                  <p className="text-sm text-gray-400">This side has been skipped</p>
                </div>

                <div className="flex flex-col gap-2.5">
                  <div className="flex flex-col sm:flex-row gap-2.5">
                    <label className="cursor-pointer flex-1 py-2.5 bg-white hover:bg-blue-50 text-blue-600 font-medium rounded-xl border border-blue-200 flex items-center justify-center gap-2 transition-colors text-sm">
                      <Camera className="w-4 h-4" />
                      <span>Capture Instead</span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={handleCameraChange}
                      />
                    </label>
                    <label className="cursor-pointer flex-1 py-2.5 bg-white hover:bg-blue-50 text-blue-600 font-medium rounded-xl border border-blue-200 flex items-center justify-center gap-2 transition-colors text-sm">
                      <Upload className="w-4 h-4" />
                      <span>Upload Instead</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleGalleryChange}
                      />
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={handleContinueSide}
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors text-sm active:scale-95"
                  >
                    Continue
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Bottom safe area for iOS notch devices */}
          <div className="h-safe-area-bottom" />
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STAGE: REVIEW
  // ═══════════════════════════════════════════════════════════════════════════

  if (stage === 'REVIEW') {
    const capturedCount = SIDE_DEFS.filter(({ key }) => sides[key].status === 'CAPTURED').length;
    const skippedCount = SIDE_DEFS.filter(({ key }) => sides[key].status === 'SKIPPED').length;

    return (
      <div className="fixed inset-0 z-50 bg-gray-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 pb-16 sm:pb-4">
        <div className="bg-white border border-gray-200 rounded-t-2xl sm:rounded-xl w-full sm:max-w-lg flex flex-col shadow-2xl max-h-[calc(92svh-4rem)] sm:max-h-[95vh] overflow-hidden">
          {renderHeader(
            'Review Captured Sides',
            `${capturedCount} captured · ${skippedCount} skipped`
          )}

          <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-2.5">
            {SIDE_DEFS.map(({ key, label }) => {
              const s = sides[key];
              const isCaptured = s.status === 'CAPTURED';
              return (
                <div
                  key={key}
                  className={`border rounded-xl p-3 flex flex-wrap items-center gap-3 transition-colors ${
                    isCaptured
                      ? 'bg-emerald-50/50 border-emerald-100'
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  {/* Status icon */}
                  <span
                    className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center ${
                      isCaptured ? 'bg-emerald-100' : 'bg-gray-200'
                    }`}
                  >
                    {isCaptured ? (
                      <Check className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Ban className="w-4 h-4 text-gray-400" />
                    )}
                  </span>

                  {/* Label + status text */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-gray-700 uppercase tracking-wide truncate">
                      {label}
                    </p>
                    <p
                      className={`text-xs font-medium mt-0.5 ${
                        isCaptured ? 'text-emerald-600' : 'text-gray-400'
                      }`}
                    >
                      {isCaptured ? '✓ Captured' : '⊘ Skipped'}
                    </p>
                  </div>

                  {/* Thumbnail */}
                  {isCaptured && s.previewUrl && (
                    <div className="w-12 h-12 shrink-0 rounded-lg overflow-hidden border border-emerald-100 bg-black">
                      <img
                        src={s.previewUrl}
                        alt={`${label} thumbnail`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  <div className="shrink-0 flex flex-wrap items-center gap-1.5">
                    {isCaptured ? (
                      <label
                        className="cursor-pointer px-2.5 py-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900 bg-white border border-gray-200 hover:border-gray-300 rounded-lg transition-colors flex items-center gap-1"
                        onClick={() => markReviewTargetSide(key)}
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Retake</span>
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          className="hidden"
                          onChange={handleReviewCameraChange}
                        />
                      </label>
                    ) : (
                      <>
                        <label
                          className="cursor-pointer px-2.5 py-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 border border-blue-200 hover:border-blue-300 rounded-lg transition-colors flex items-center gap-1"
                          onClick={() => markReviewTargetSide(key)}
                        >
                          <Camera className="w-3 h-3" />
                          <span>Capture Instead</span>
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                            onChange={handleReviewCameraChange}
                          />
                        </label>
                        <label
                          className="cursor-pointer px-2.5 py-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 border border-blue-200 hover:border-blue-300 rounded-lg transition-colors flex items-center gap-1"
                          onClick={() => markReviewTargetSide(key)}
                        >
                          <Upload className="w-3 h-3" />
                          <span>Upload</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleReviewGalleryChange}
                          />
                        </label>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="px-4 md:px-5 py-4 border-t border-gray-200 bg-white shrink-0 flex flex-col-reverse sm:flex-row gap-3 sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={handleClose}
              className="w-full sm:w-auto px-4 py-2.5 bg-white border border-gray-200 text-gray-600 font-medium rounded-lg hover:bg-gray-50 transition-colors text-sm"
            >
              Cancel
            </button>

            {capturedCount === 0 ? (
              <p className="text-xs text-amber-600 font-medium text-center">
                Capture at least one side before continuing.
              </p>
            ) : (
              <button
                type="button"
                onClick={handleReviewContinue}
                className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-sm flex items-center justify-center gap-2 transition-colors text-sm active:scale-95"
              >
                Continue
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="h-safe-area-bottom sm:hidden" />
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STAGE: DETAILS
  // ═══════════════════════════════════════════════════════════════════════════

  const capturedCount = SIDE_DEFS.filter(({ key }) => sides[key].status === 'CAPTURED').length;

  return (
    <div className="fixed inset-0 z-50 bg-gray-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 pb-16 sm:pb-4">
      <div className="bg-white border border-gray-200 rounded-t-2xl sm:rounded-xl w-full sm:max-w-md flex flex-col shadow-2xl max-h-[calc(92svh-4rem)] sm:max-h-[95vh] overflow-hidden">
        {renderHeader(
          'Add New Product',
          `${capturedCount} side image${capturedCount !== 1 ? 's' : ''} ready to upload`
        )}

        <div className="flex-1 overflow-y-auto">
          <form onSubmit={handleSubmitDetails} className="p-4 md:p-6 space-y-4 text-sm">
            {/* Product Name */}
            <div>
              <label htmlFor="wizard-prod-name" className="block text-gray-700 font-medium mb-1.5">
                Product Name <span className="text-rose-500">*</span>
              </label>
              <input
                id="wizard-prod-name"
                type="text"
                required
                value={prodName}
                onChange={(e) => setProdName(e.target.value)}
                placeholder="e.g. Premium Almond Milk"
                className="w-full border border-gray-300 rounded-lg p-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
              />
            </div>

            {/* Category */}
            <div>
              <label htmlFor="wizard-prod-category" className="block text-gray-700 font-medium mb-1.5">
                Category
              </label>
              <select
                id="wizard-prod-category"
                value={prodCategory}
                onChange={(e) => setProdCategory(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
              >
                <option value="Food">Food &amp; Beverage</option>
                <option value="Cosmetics">Cosmetics &amp; Personal Care</option>
                <option value="Household">Household Goods</option>
                <option value="Electronics">Electronics</option>
                <option value="Medical">Medical Devices</option>
                <option value="General">General Commodity</option>
              </select>
            </div>

            {/* Brand */}
            <div>
              <label htmlFor="wizard-prod-brand" className="block text-gray-700 font-medium mb-1.5">
                Brand Name
              </label>
              <input
                id="wizard-prod-brand"
                type="text"
                value={prodBrand}
                onChange={(e) => setProdBrand(e.target.value)}
                placeholder="e.g. Apex Consumer"
                className="w-full border border-gray-300 rounded-lg p-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
              />
            </div>

            {/* Barcode */}
            <div>
              <label htmlFor="wizard-prod-barcode" className="block text-gray-700 font-medium mb-1.5">
                Barcode / EAN
              </label>
              <input
                id="wizard-prod-barcode"
                type="text"
                value={prodBarcode}
                onChange={(e) => setProdBarcode(e.target.value)}
                placeholder="e.g. 8901234567890"
                className="w-full border border-gray-300 rounded-lg p-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white font-mono"
              />
            </div>

            {/* Sides summary chips */}
            <div className="bg-gray-50 border border-gray-100 rounded-lg p-3 flex flex-wrap gap-1.5">
              {SIDE_DEFS.map(({ key, shortLabel }) => {
                const s = sides[key];
                const isCaptured = s.status === 'CAPTURED';
                return (
                  <span
                    key={key}
                    className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded border ${
                      isCaptured
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-white text-gray-300 border-gray-200'
                    }`}
                  >
                    {isCaptured ? (
                      <Check className="w-3 h-3" />
                    ) : (
                      <Ban className="w-3 h-3" />
                    )}
                    {shortLabel}
                  </span>
                );
              })}
            </div>

            {/* Error */}
            {submitError && (
              <div className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{submitError}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setStage('REVIEW')}
                disabled={isSubmitting}
                className="w-full sm:w-auto px-4 py-2.5 bg-white border border-gray-200 text-gray-600 font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 text-sm"
              >
                ← Back to Review
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !prodName.trim()}
                className="w-full sm:flex-1 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50 text-sm active:scale-95"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Creating &amp; Uploading…
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Add Product &amp; Continue
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        <div className="h-safe-area-bottom sm:hidden" />
      </div>
    </div>
  );
};
