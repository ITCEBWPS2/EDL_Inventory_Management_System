import React, { useRef, useState } from 'react';
import { UploadCloud, FileCheck, X, Eye, AlertCircle, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENT_KB,
  formatFileSize,
  validateAttachmentFile
} from '../../constants/upload';
import { compressImageToLimit } from '../../utils/imageCompressor';

export const FileUploadBox = ({
  file = null,
  onFileChange,
  existingUrl = null,
  label = 'Attachment / Photo (Optional)',
  helperText = `JPG, PNG, WebP up to ${MAX_ATTACHMENT_KB}KB`,
  accept = 'image/png,image/jpeg,image/webp,image/jpg',
  className = ''
}) => {
  const fileInputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [rejectedFile, setRejectedFile] = useState(null);
  const [isCompressing, setIsCompressing] = useState(false);

  const resetFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleProcessFile = (candidateFile) => {
    if (!candidateFile) return;

    const validation = validateAttachmentFile(candidateFile);
    if (!validation.valid) {
      resetFileInput();
      onFileChange(null);
      setErrorMessage(validation.error);
      setRejectedFile(validation.code === 'LIMIT_FILE_SIZE' ? candidateFile : null);
      toast.error(validation.error);
      return;
    }

    // File is valid
    setErrorMessage('');
    setRejectedFile(null);
    onFileChange(candidateFile);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      // If multiple files dropped, check each file
      for (let i = 0; i < files.length; i++) {
        const check = validateAttachmentFile(files[i]);
        if (!check.valid) {
          handleProcessFile(files[i]);
          return;
        }
      }
      handleProcessFile(files[0]);
    }
  };

  const handleInputChange = (e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        const check = validateAttachmentFile(files[i]);
        if (!check.valid) {
          handleProcessFile(files[i]);
          return;
        }
      }
      handleProcessFile(files[0]);
    }
  };

  const handleRemove = (e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    resetFileInput();
    setErrorMessage('');
    setRejectedFile(null);
    onFileChange(null);
  };

  const handleAutoCompress = async (e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (!rejectedFile) return;

    setIsCompressing(true);
    try {
      const compressed = await compressImageToLimit(rejectedFile, MAX_ATTACHMENT_BYTES);
      setErrorMessage('');
      setRejectedFile(null);
      resetFileInput();
      onFileChange(compressed);
      toast.success(`Image compressed to ${formatFileSize(compressed.size)} and attached.`);
    } catch (err) {
      toast.error(err.message || 'Image compression failed.');
    } finally {
      setIsCompressing(false);
    }
  };

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && <label className="block text-xs font-semibold text-slate mb-1">{label}</label>}

      {/* Selected File / Existing Voucher View */}
      {file || existingUrl ? (
        <div className="flex items-center justify-between p-3.5 bg-surface border border-line rounded-xl">
          <div className="flex items-center gap-3 truncate">
            {file ? (
              <div className="w-9 h-9 rounded-lg bg-signal/15 text-signal flex items-center justify-center shrink-0">
                <FileCheck className="w-5 h-5" />
              </div>
            ) : existingUrl ? (
              <img
                src={existingUrl}
                alt="Attached Voucher"
                className="w-9 h-9 object-cover rounded-lg border border-line shrink-0"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  if (e.currentTarget.nextSibling) {
                    e.currentTarget.nextSibling.style.display = 'flex';
                  }
                }}
              />
            ) : null}
            <div className="hidden w-9 h-9 rounded-lg bg-surface items-center justify-center text-signal shrink-0">
              <FileCheck className="w-5 h-5" />
            </div>

            <div className="truncate">
              <div className="text-xs font-semibold text-ink truncate">
                {file ? file.name : 'Attached Voucher Image'}
              </div>
              <div className="text-[11px] text-slate font-mono">
                {file ? formatFileSize(file.size) : 'Stored in EDL secure vault'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {existingUrl && (
              <a
                href={existingUrl}
                target="_blank"
                rel="noreferrer"
                className="p-1.5 rounded-lg hover:bg-card border border-transparent hover:border-line text-slate hover:text-ink text-xs flex items-center gap-1"
                title="View document"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>View</span>
              </a>
            )}
            <button
              type="button"
              onClick={handleRemove}
              className="p-1.5 rounded-lg hover:bg-[#B4483A]/10 text-slate hover:text-[#B4483A] transition-colors"
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
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors group ${
            errorMessage
              ? 'border-[#B4483A]/70 bg-[#B4483A]/5 hover:bg-[#B4483A]/10'
              : dragOver
              ? 'border-signal bg-signal-light/30'
              : 'border-line hover:border-signal/70 bg-surface/30 hover:bg-surface/60'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={accept}
            className="hidden"
            onChange={handleInputChange}
          />
          <div className="w-9 h-9 rounded-full bg-card border border-line flex items-center justify-center mx-auto mb-2 text-slate group-hover:text-signal group-hover:border-signal transition-colors shadow-subtle">
            <UploadCloud className="w-4 h-4" />
          </div>
          <div className="text-xs font-medium text-ink">
            Click to upload photo or voucher image
          </div>
          <div className="text-[11px] text-slate/70 mt-0.5">{helperText}</div>
        </div>
      )}

      {/* Inline Error and Optional Auto-Compress Action */}
      {errorMessage && (
        <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-lg bg-[#B4483A]/10 border border-[#B4483A]/25 text-[#B4483A] text-xs animate-fade-in">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="font-medium flex-1">{errorMessage}</span>
          {rejectedFile && (
            <button
              type="button"
              onClick={handleAutoCompress}
              disabled={isCompressing}
              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-[#B4483A]/15 hover:bg-[#B4483A]/25 text-[#B4483A] font-semibold text-[11px] transition-colors disabled:opacity-50"
            >
              <Sparkles className="w-3 h-3" />
              <span>{isCompressing ? 'Compressing...' : 'Compress automatically'}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default FileUploadBox;
