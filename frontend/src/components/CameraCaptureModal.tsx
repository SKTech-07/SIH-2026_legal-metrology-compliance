import React, { useRef, useState, useEffect } from 'react';
import { Camera, RefreshCw, Check, X, Upload, FlipHorizontal } from 'lucide-react';
import type { PackageSide } from '../types';

interface Props {
  copyId: string;
  isOpen: boolean;
  onClose: () => void;
  onImageUploaded: () => void;
  apiUpload: (copyId: string, side: PackageSide, file: File) => Promise<any>;
}

const SIDES: PackageSide[] = ['FRONT', 'BACK', 'LEFT', 'RIGHT', 'TOP', 'BOTTOM'];

export const CameraCaptureModal: React.FC<Props> = ({ copyId, isOpen, onClose, onImageUploaded, apiUpload }) => {
  const [selectedSide, setSelectedSide] = useState<PackageSide>('FRONT');
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && !capturedBlob) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [isOpen, capturedBlob]);

  const startCamera = async () => {
    try {
      setErrorMsg(null);
      // Request permission just to verify access, then immediately stop to avoid locking the camera.
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
      mediaStream.getTracks().forEach((track) => track.stop());
    } catch (err: any) {
      setErrorMsg('Camera access denied or unavailable. Please ensure camera permissions are granted.');
    }
  };

  const stopCamera = () => {
    // No continuous stream to stop in this implementation
  };

  const retakePhoto = () => {
    setCapturedBlob(null);
    setPreviewUrl(null);
    startCamera();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setCapturedBlob(file);
      setPreviewUrl(URL.createObjectURL(file));
      stopCamera();
    }
  };

  const saveImage = async () => {
    if (!capturedBlob) return;
    setIsUploading(true);
    try {
      const file = new File([capturedBlob], `package_${selectedSide}.jpg`, { type: 'image/jpeg' });
      await apiUpload(copyId, selectedSide, file);
      onImageUploaded();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Failed to upload package image');
    } finally {
      setIsUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950 shrink-0">
          <div className="flex items-center space-x-2">
            <Camera className="w-5 h-5 text-amber-400" />
            <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wide">
              360° Package Image Capture
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 md:p-6 space-y-4 overflow-y-auto">
          {/* Side Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase mb-2">
              Select Package Side
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {SIDES.map((side) => (
                <button
                  key={side}
                  onClick={() => setSelectedSide(side)}
                  className={`py-2 px-1 text-xs font-bold rounded-lg border transition-all ${
                    selectedSide === side
                      ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md scale-105'
                      : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-750'
                  }`}
                >
                  {side}
                </button>
              ))}
            </div>
          </div>

          {/* Camera / Preview Box */}
          <div className="relative aspect-video bg-black rounded-xl overflow-hidden border border-slate-800 flex flex-col items-center justify-center p-6 text-center">
            {previewUrl ? (
              <img src={previewUrl} alt="Captured" className="w-full h-full object-contain" />
            ) : (
              <>
                <Camera className="w-12 h-12 text-slate-700 mb-3" />
                <div className="absolute top-3 left-3 bg-slate-950/70 backdrop-blur-md px-3 py-1 rounded-md text-xs font-bold text-amber-400 border border-slate-700">
                  SIDE: {selectedSide}
                </div>
              </>
            )}
          </div>

          {errorMsg && (
            <div className="p-3 bg-rose-950/60 border border-rose-800 text-rose-300 text-xs rounded-lg">
              {errorMsg}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-4 md:px-6 py-4 bg-slate-950 border-t border-slate-800 flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-4 shrink-0">
          <label className="cursor-pointer inline-flex items-center text-xs font-bold text-slate-400 hover:text-slate-200">
            <Upload className="w-4 h-4 mr-1.5" />
            Upload File
            <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
          </label>

          <div className="flex items-center space-x-3">
            {previewUrl ? (
              <>
                <button
                  onClick={retakePhoto}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-lg border border-slate-700 inline-flex items-center"
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Retake
                </button>
                <button
                  onClick={saveImage}
                  disabled={isUploading}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow-md inline-flex items-center disabled:opacity-50"
                >
                  {isUploading ? <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Check className="w-4 h-4 mr-1.5" />}
                  Save & Analyze
                </button>
              </>
            ) : (
              <label className="cursor-pointer px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black uppercase tracking-wider rounded-lg shadow-lg inline-flex items-center">
                <Camera className="w-4 h-4 mr-2" /> Take Picture
                <input 
                  type="file" 
                  accept="image/*" 
                  capture="environment" 
                  onChange={handleFileUpload} 
                  className="hidden" 
                />
              </label>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
