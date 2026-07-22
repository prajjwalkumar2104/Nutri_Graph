'use client';

import { useState } from 'react';
import { Upload, X, Activity, FileUp } from 'lucide-react';

interface UploadModalProps {
  onUploadSuccess: (data: any) => void; 
}

export default function UploadModal({ onUploadSuccess }: UploadModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);

 const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setIsUploading(true);
    
    try {
      const formData = new FormData();
      // 1. Changed key to 'files' to match your backend multer config
      formData.append('files', file); 

      // 2. Added the full http://localhost:5000 URL to hit your Express server
      const response = await fetch('http://localhost:5000/api/parse-report', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Failed to parse report');
      
      const result = await response.json();
      
      onUploadSuccess(result);
      
      setIsOpen(false);
      setFile(null);
    } catch (error) {
      console.error("Upload failed", error);
      alert("Failed to parse the lab report.");
    } finally {
      setIsUploading(false);
    }
  };

  
  return (
    <>
      {/* Floating Action Button (Z-40: Above graph, below modals) */}
      <button
        onClick={() => setIsOpen(true)}
        className="absolute bottom-8 right-8 z-40 flex items-center gap-2 bg-amber-500 text-white px-5 py-3 rounded-full shadow-lg hover:bg-amber-600 hover:-translate-y-1 transition-all duration-200 ease-in-out font-medium"
      >
        <FileUp size={20} />
        <span>Parse Lab Report</span>
      </button>

      {/* Modal Overlay (Z-60: Covers everything) */}
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm transition-opacity">
          
          <div className="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-md relative animate-in fade-in zoom-in-95 duration-200">
            
            <button
              onClick={() => {
                setIsOpen(false);
                setFile(null);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-1 rounded-md transition-colors"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                <Activity size={24} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-800">Analyze Report</h2>
                <p className="text-sm text-slate-500">Upload PDF or Image for Gemini extraction</p>
              </div>
            </div>

            <form onSubmit={handleUploadSubmit}>
              <label className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center transition-colors cursor-pointer mb-6 ${file ? 'border-amber-500 bg-amber-50' : 'border-slate-300 bg-slate-50 hover:bg-slate-100'}`}>
                <Upload className={file ? "text-amber-500 mb-3" : "text-slate-400 mb-3"} size={32} />
                <p className="text-sm font-medium text-slate-700">
                  {file ? file.name : "Click to browse or drag and drop"}
                </p>
                <input 
                  type="file" 
                  className="hidden" 
                  accept=".pdf,image/png,image/jpeg" 
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
              </label>

              <div className="flex justify-end gap-3">
                <button 
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    setFile(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isUploading || !file}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isUploading ? 'Extracting...' : 'Run Extraction'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}
    </>
  );
}