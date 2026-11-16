import { useState } from 'react';
import { Download, Loader2, X } from 'lucide-react';
import {
  DocumentRecord,
  formatDocumentDate,
  formatFileSize,
} from './documentTypes';

interface DocumentPreviewModalProps {
  documentItem: DocumentRecord;
  previewUrl: string;
  onClose: () => void;
  onDownload: (item: DocumentRecord) => Promise<void>;
}

/**
 * Modal for previewing image documents (JPG, PNG) using a temporary on-demand download URL.
 */
export function DocumentPreviewModal({
  documentItem,
  previewUrl,
  onClose,
  onDownload,
}: DocumentPreviewModalProps) {
  const [downloading, setDownloading] = useState(false);

  const handleDownloadClick = async () => {
    setDownloading(true);
    try {
      await onDownload(documentItem);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/65 backdrop-blur-[1px] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="doc-preview-title"
    >
      <div className="w-full max-w-4xl bg-white rounded-xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4 shrink-0">
          <div className="min-w-0">
            <h2
              id="doc-preview-title"
              className="text-base font-semibold text-slate-900 truncate"
            >
              {documentItem.fileName}
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="inline-flex items-center rounded-full bg-blue-50 text-[#2563EB] px-2.5 py-0.5 font-medium">
                {documentItem.category}
              </span>
              <span className="font-mono tabular-nums">
                {formatFileSize(documentItem.size)}
              </span>
              <span>·</span>
              <span>Uploaded {formatDocumentDate(documentItem.createdAt)}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleDownloadClick}
              disabled={downloading}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563EB] px-3.5 py-2 text-xs font-medium text-white hover:bg-[#1D4ED8] disabled:opacity-60 transition-colors shadow-xs cursor-pointer"
            >
              {downloading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              <span>{downloading ? 'Downloading...' : 'Download'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
              aria-label="Close preview"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Image Container */}
        <div className="flex-1 overflow-auto bg-slate-900/5 p-6 flex items-center justify-center min-h-[280px]">
          <img
            src={previewUrl}
            alt={documentItem.fileName}
            className="max-w-full max-h-[68vh] rounded-lg border border-slate-200 bg-white object-contain shadow-sm"
          />
        </div>

        {/* Footer metadata / note */}
        {(documentItem.note || documentItem.uploadedBy) && (
          <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-slate-600">
            <div className="truncate">
              {documentItem.note ? (
                <>
                  <span className="font-medium text-slate-700">Note: </span>
                  <span>{documentItem.note}</span>
                </>
              ) : (
                <span className="text-slate-400">No note attached</span>
              )}
            </div>
            <div className="font-mono text-slate-500 shrink-0">
              By {documentItem.uploadedBy}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
