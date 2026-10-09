import React, { useRef, useState } from 'react';
import { UploadCloud, FileCheck, X, Eye } from 'lucide-react';

export const FileUploadBox = ({
  file,
  onFileChange,
  existingUrl = null,
  label = 'Voucher Attachment',
  helperText = 'Upload official certified receipt or store voucher (PNG, JPG, PDF up to 15MB)'
}) => {
  const fileInputRef = useRef(null);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFileChange(e.dataTransfer.files[0]);
    }
  };

  return (
    <div>
      <label className="block text-xs font-medium text-ink mb-1.5">{label}</label>

      {/* Selected File / Existing Voucher View */}
      {file || existingUrl ? (
        <div className="flex items-center justify-between p-3.5 bg-surface border border-line rounded-lg">
          <div className="flex items-center gap-3 truncate">
            <div className="w-8 h-8 rounded bg-signal/15 text-signal flex items-center justify-center shrink-0">
              <FileCheck className="w-4 h-4" />
            </div>
            <div className="truncate">
              <div className="text-xs font-medium text-ink truncate">
                {file ? file.name : 'Attached Voucher Document'}
              </div>
              <div className="text-[10px] text-slate">
                {file ? `${(file.size / 1024).toFixed(1)} KB` : 'Stored in EDL secure vault'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {existingUrl && (
              <a
                href={existingUrl}
                target="_blank"
                rel="noreferrer"
                className="p-1.5 rounded hover:bg-card border border-transparent hover:border-line text-slate hover:text-ink text-xs flex items-center gap-1"
                title="View document"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>View</span>
              </a>
            )}
            <button
              type="button"
              onClick={() => onFileChange(null)}
              className="p-1.5 rounded hover:bg-[#B4483A]/10 text-slate hover:text-[#B4483A]"
              title="Remove attachment"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        /* Click-to-upload Drop Area */
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className="border-2 border-dashed border-line hover:border-signal/70 bg-surface/40 hover:bg-signal-light/20 rounded-lg p-5 text-center cursor-pointer transition-colors group"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,application/pdf"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                onFileChange(e.target.files[0]);
              }
            }}
          />
          <div className="w-9 h-9 rounded-full bg-card border border-line flex items-center justify-center mx-auto mb-2 text-slate group-hover:text-signal group-hover:border-signal transition-colors shadow-subtle">
            <UploadCloud className="w-4 h-4" />
          </div>
          <div className="text-xs font-medium text-ink">
            Click to upload or drag & drop voucher file
          </div>
          <div className="text-[11px] text-slate mt-0.5">{helperText}</div>
        </div>
      )}
    </div>
  );
};
