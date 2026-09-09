import React, { useState, useEffect, useRef } from 'react';
import { X, ShieldAlert, ImageOff } from 'lucide-react';
import type { Violation } from '../types';

interface Props {
  violation: Violation | null;
  isOpen: boolean;
  onClose: () => void;
  /** Resolved absolute URL of the product image (same one shown in IMAGE VIEWER).
   *  Passed in by ProductCapturePage which already knows getBaseUrl() + selectedImage. */
  fallbackImageUrl?: string;
  detections?: any[];
}

export const EvidenceViewerModal: React.FC<Props> = ({
  violation,
  isOpen,
  onClose,
  fallbackImageUrl,
  detections,
}) => {
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);
  
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [imgLayout, setImgLayout] = useState<{
    scale: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);

  const calculateLayout = () => {
    if (!imgRef.current || !containerRef.current) return;
    const img = imgRef.current;
    const container = containerRef.current;

    const natW = img.naturalWidth;
    const natH = img.naturalHeight;

    if (natW === 0 || natH === 0) return;

    const contW = container.clientWidth;
    const contH = container.clientHeight;

    // object-fit: contain scale logic
    const scale = Math.min(contW / natW, contH / natH);
    const renderW = natW * scale;
    const renderH = natH * scale;

    const offsetX = (contW - renderW) / 2;
    const offsetY = (contH - renderH) / 2;

    setImgLayout({ scale, offsetX, offsetY });
  };

  useEffect(() => {
    if (!isOpen || !violation) {
      setImgSrc(null);
      setImgError(false);
      setImgLayout(null);
      return;
    }

    // Priority 1: annotated evidence image from the backend (if it exists and is valid)
    const ev = violation.evidence?.[0];
    const annotatedUrl = ev?.annotated_image_url ?? null;
    
    // Priority 2: the product image that the IMAGE VIEWER is already showing
    const candidate = annotatedUrl || fallbackImageUrl || null;

    console.log(
      '[EVIDENCE-IMAGE]',
      `Violation: ${violation.rule_code}`,
      `| Annotated URL: ${annotatedUrl ?? 'none'}`,
      `| Fallback URL: ${fallbackImageUrl ?? 'none'}`,
      `| Using: ${candidate ?? 'none'}`,
    );

    setImgSrc(candidate);
    setImgError(false);
  }, [isOpen, violation, fallbackImageUrl]);

  useEffect(() => {
    window.addEventListener('resize', calculateLayout);
    return () => window.removeEventListener('resize', calculateLayout);
  }, []);

  if (!isOpen || !violation) return null;

  const handleImgError = () => {
    console.warn('[EVIDENCE-IMAGE] Primary image failed, trying fallback.', imgSrc);
    // If the annotated image failed, try the raw product image
    if (imgSrc !== fallbackImageUrl && fallbackImageUrl) {
      setImgSrc(fallbackImageUrl);
    } else {
      // Both failed
      setImgError(true);
    }
  };

  const getRelevantBBox = () => {
    // 1. Check if evidence explicitly gives us a non-dummy bounding box
    const ev = violation.evidence?.[0];
    const ruleBbox = ev?.bbox_json; // [x, y, w, h]
    if (ruleBbox && ruleBbox.length === 4) {
      const [x, y, w, h] = ruleBbox;
      // Filter out obvious dummy/default boxes (e.g. [100, 100, 300, 100])
      if (w > 0 && h > 0 && !(x === 100 && y === 100 && w === 300 && h === 100)) {
        return ruleBbox;
      }
    }

    // 2. Fallback: try to find it in the OCR detections based on rule_code mapped to declaration_type.
    if (!detections || detections.length === 0) return null;
    
    const ruleToType: Record<string, string[]> = {
      'LM-MRP-001': ['MRP'],
      'LM-DATE-001': ['PACKING_DATE'],
      'LM-DATE-002': ['IMPORT_DATE'],
      'LM-DATE-003': ['EXPIRY_DATE', 'BEST_BEFORE'],
      'LM-NETQTY-001': ['NET_QUANTITY'],
      'LM-MFR-001': ['MANUFACTURER'],
      'LM-CC-001': ['CONSUMER_CARE'],
      'LM-BATCH-001': ['BATCH_NUMBER'],
      'LM-COO-001': ['COUNTRY_OF_ORIGIN'],
    };
    
    const targetTypes = violation.rule_code ? ruleToType[violation.rule_code] : null;
    if (targetTypes) {
      const match = detections.find(d => targetTypes.includes(d.declaration_type));
      if (match && match.bbox && match.bbox.length === 4) {
        return match.bbox;
      }
    }
    
    return null;
  };

  const renderBBoxes = () => {
    if (!imgLayout) return null;
    const { scale, offsetX, offsetY } = imgLayout;

    const boxes: React.ReactNode[] = [];
    const relevantBBox = getRelevantBBox();

    // Draw all context detections
    if (detections && detections.length > 0) {
      detections.forEach((d, idx) => {
        if (!d.bbox || d.bbox.length !== 4) return;
        const [x, y, w, h] = d.bbox;
        
        // Skip drawing it as context if it's the exact same box as the relevant one
        if (relevantBBox && x === relevantBBox[0] && y === relevantBBox[1]) {
           return;
        }

        boxes.push(
          <div
            key={`det-${idx}`}
            className="absolute border border-cyan-400/30 bg-cyan-400/5 z-0 pointer-events-none"
            style={{
              left: offsetX + x * scale,
              top: offsetY + y * scale,
              width: w * scale,
              height: h * scale,
            }}
          />
        );
      });
    }

    // Draw the rule-specific box
    if (relevantBBox) {
      const [x, y, w, h] = relevantBBox;
      boxes.push(
        <div
          key="rule-box"
          className="absolute border-[3px] border-rose-500 bg-rose-500/30 z-10 pointer-events-none animate-pulse"
          style={{
            left: offsetX + x * scale,
            top: offsetY + y * scale,
            width: w * scale,
            height: h * scale,
            boxShadow: '0 0 10px rgba(244,63,94,0.8)'
          }}
        />
      );
    }

    return boxes;
  };

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
          {/* Evidence Image */}
          <div 
            ref={containerRef}
            className="bg-black rounded-xl overflow-hidden border border-rose-900/60 shadow-lg relative flex items-center justify-center min-h-[200px] h-[55vh]"
          >
            {imgError || !imgSrc ? (
              /* Both sources failed or no image available */
              <div className="flex flex-col items-center justify-center space-y-3 py-12 px-6 text-center">
                <ImageOff className="w-10 h-10 text-slate-600" />
                <p className="text-slate-500 text-sm font-mono">Evidence image unavailable</p>
                {violation.rule_code && (
                  <p className="text-slate-600 text-xs font-mono">{violation.rule_code}</p>
                )}
              </div>
            ) : (
              <>
                <img
                  ref={imgRef}
                  src={imgSrc}
                  alt={`Evidence for violation ${violation.rule_code}`}
                  className="w-full h-full object-contain pointer-events-none"
                  onError={handleImgError}
                  onLoad={calculateLayout}
                />
                {renderBBoxes()}
              </>
            )}

            <div className="absolute top-2 left-2 md:top-3 md:left-3 bg-rose-950/90 border border-rose-700 text-rose-200 px-2 py-1 md:px-3 rounded-md text-[10px] md:text-xs font-bold font-mono pointer-events-none z-20">
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
