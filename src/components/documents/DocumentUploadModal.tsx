import { useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Image as ImageIcon,
  Loader2,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { addDoc, collection, deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { ClientRecord } from '../clients/clientTypes';
import { db } from '../../lib/firebase';
import {
  blobToBase64,
  DOCUMENT_CATEGORIES,
  extractFirebaseErrorCode,
  formatFileSize,
  getFriendlyDocumentError,
  logDocumentActivity,
  prepareDocumentBlob,
  splitBase64IntoChunks,
  validateDocumentFile,
} from './documentTypes';

interface QueuedFile {
  localId: string;
  file: File;
  normalizedType: string;
  progress: number;
  status: 'ready' | 'uploading' | 'saving' | 'done' | 'error';
  error?: string;
}

interface DocumentUploadModalProps {
  /** Fixed client when opened inside Client Profile; optional when opened from main /documents page. */
  clientId?: string;
  clientName?: string;
  /** Optional list of clients when uploading from the main Documents page. */
  clientsList?: ClientRecord[];
  currentUserEmail: string;
  onClose: () => void;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}

/**
 * Multi-file document upload modal enforcing JPG/PNG/PDF and 5 MB limits,
 * compressing images via canvas, splitting base64 into Firestore chunks,
 * and displaying per-file progress bars.
 */
export function DocumentUploadModal({
  clientId: fixedClientId,
  clientName: fixedClientName,
  clientsList,
  currentUserEmail,
  onClose,
  onSuccess,
  onError,
}: DocumentUploadModalProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [selectedClientId, setSelectedClientId] = useState(fixedClientId || '');
  const [selectedCategory, setSelectedCategory] = useState<string>('CNIC');
  const [customCategory, setCustomCategory] = useState('');
  const [note, setNote] = useState('');
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const resolvedClient = fixedClientId
    ? { id: fixedClientId, name: fixedClientName || 'Client' }
    : clientsList?.find((c) => c.id === selectedClientId)
      ? {
          id: selectedClientId,
          name: clientsList.find((c) => c.id === selectedClientId)!.name,
        }
      : null;

  const finalCategory =
    selectedCategory === 'Other'
      ? customCategory.trim() || 'Other'
      : selectedCategory;

  const handleFilesSelected = (incomingFiles: FileList | null) => {
    if (!incomingFiles || incomingFiles.length === 0) return;
    setValidationError(null);

    const nextItems: QueuedFile[] = [];
    const errors: string[] = [];

    Array.from(incomingFiles).forEach((file) => {
      const check = validateDocumentFile(file);
      if (!check.valid) {
        if (check.error) errors.push(check.error);
        return;
      }
      nextItems.push({
        localId: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        file,
        normalizedType: check.normalizedType,
        progress: 0,
        status: 'ready',
      });
    });

    if (errors.length > 0) {
      const firstErr = errors[0];
      setValidationError(errors.join(' '));
      onError(firstErr);
    }

    if (nextItems.length > 0) {
      setQueue((prev) => [...prev, ...nextItems]);
    }
  };

  const removeQueuedFile = (localId: string) => {
    if (uploading) return;
    setQueue((prev) => prev.filter((item) => item.localId !== localId));
  };

  const updateQueuedFile = (
    localId: string,
    updater: (item: QueuedFile) => QueuedFile
  ) => {
    setQueue((prev) =>
      prev.map((item) => (item.localId === localId ? updater(item) : item))
    );
  };

  const uploadSingleFile = async (
    item: QueuedFile,
    targetClientId: string,
    targetClientName: string
  ): Promise<{ ok: boolean; errorMessage?: string }> => {
    updateQueuedFile(item.localId, (prev) => ({
      ...prev,
      status: 'uploading',
      progress: 0,
      error: undefined,
    }));

    let createdDocId = '';
    const writtenChunkIds: string[] = [];

    try {
      // 1. Compress/resize images (max 1600px, JPEG 0.8); keep PDFs unmodified
      const prepared = await prepareDocumentBlob(item.file, item.normalizedType);

      // 2. Convert to base64 and split into 700,000-char chunks
      const base64Data = await blobToBase64(prepared.blob);
      const chunks = splitBase64IntoChunks(base64Data);

      // 3. Create the Firestore metadata document in collection "documents"
      const createdRef = await addDoc(collection(db, 'documents'), {
        clientId: targetClientId,
        clientName: targetClientName,
        fileName: item.file.name.trim(),
        category: finalCategory,
        note: note.trim(),
        fileType: prepared.fileType,
        size: prepared.size,
        chunkCount: chunks.length,
        uploadedBy: currentUserEmail,
        createdAt: serverTimestamp(),
      });
      createdDocId = createdRef.id;

      // 4. Write each chunk in order under documents/{docId}/chunks/{index}
      for (let index = 0; index < chunks.length; index += 1) {
        const chunkId = String(index);
        await setDoc(doc(db, 'documents', createdDocId, 'chunks', chunkId), {
          index,
          data: chunks[index],
        });
        writtenChunkIds.push(chunkId);

        const pct = Math.round(((index + 1) / chunks.length) * 100);
        updateQueuedFile(item.localId, (prev) => ({
          ...prev,
          progress: pct,
        }));
      }

      updateQueuedFile(item.localId, (prev) => ({
        ...prev,
        progress: 100,
        status: 'saving',
      }));

      // 5. Record audit log entry (non-blocking if logging fails)
      try {
        await logDocumentActivity({
          userEmail: currentUserEmail,
          action: 'uploaded_document',
          clientId: targetClientId,
          targetId: createdDocId,
          details: `Uploaded "${item.file.name.trim()}" (${finalCategory}, ${formatFileSize(prepared.size)}) for "${targetClientName}"`,
        });
      } catch {
        // Upload already succeeded; keep document saved
      }

      updateQueuedFile(item.localId, (prev) => ({
        ...prev,
        progress: 100,
        status: 'done',
      }));

      return { ok: true };
    } catch (err) {
      const code = extractFirebaseErrorCode(err);
      console.error('Document upload failed:', code || 'unknown', err);

      // Roll back any chunks and metadata document already created for this failed file
      if (createdDocId) {
        for (const chunkId of writtenChunkIds) {
          try {
            await deleteDoc(doc(db, 'documents', createdDocId, 'chunks', chunkId));
          } catch (cleanupErr) {
            console.error('Failed to clean up chunk during rollback:', chunkId, cleanupErr);
          }
        }
        try {
          await deleteDoc(doc(db, 'documents', createdDocId));
        } catch (cleanupErr) {
          console.error('Failed to clean up metadata document during rollback:', createdDocId, cleanupErr);
        }
      }

      const friendly = getFriendlyDocumentError(err, `upload "${item.file.name}"`);
      updateQueuedFile(item.localId, (prev) => ({
        ...prev,
        progress: 0,
        status: 'error',
        error: friendly,
      }));
      return { ok: false, errorMessage: friendly };
    }
  };

  const handleStartUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!resolvedClient) {
      setValidationError('Please select a client for these documents.');
      return;
    }

    const pendingItems = queue.filter((item) => item.status !== 'done');
    if (pendingItems.length === 0) {
      setValidationError('Please select at least one JPG, PNG, or PDF file to upload.');
      return;
    }

    setUploading(true);
    let successCount = 0;
    let failCount = 0;
    let firstErrorMessage = '';

    try {
      // Upload all queued files concurrently with independent progress bars
      const results = await Promise.all(
        pendingItems.map((item) =>
          uploadSingleFile(item, resolvedClient.id, resolvedClient.name)
        )
      );

      results.forEach((result) => {
        if (result.ok) {
          successCount += 1;
        } else {
          failCount += 1;
          if (!firstErrorMessage && result.errorMessage) {
            firstErrorMessage = result.errorMessage;
          }
        }
      });
    } catch (unexpectedErr) {
      const code = extractFirebaseErrorCode(unexpectedErr);
      console.error('Unexpected upload batch error:', code || 'unknown', unexpectedErr);
      failCount = pendingItems.length - successCount;
      firstErrorMessage = getFriendlyDocumentError(unexpectedErr, 'upload documents');
    } finally {
      setUploading(false);
    }

    if (failCount === 0 && successCount > 0) {
      onSuccess(
        successCount === 1
          ? '1 document uploaded successfully.'
          : `${successCount} documents uploaded successfully.`
      );
      onClose();
    } else if (successCount > 0 && failCount > 0) {
      onError(
        `${successCount} uploaded, ${failCount} failed. ${firstErrorMessage || 'Review the error messages below.'}`
      );
    } else if (failCount > 0) {
      onError(
        firstErrorMessage ||
          'Document upload failed. Check the file errors and your permissions.'
      );
    }
  };

  const readyOrRetryCount = queue.filter((q) => q.status !== 'done').length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-[1px] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upload-doc-modal-title"
    >
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-white flex items-center justify-between gap-4 shrink-0">
          <div>
            <h2
              id="upload-doc-modal-title"
              className="text-base font-semibold text-slate-900"
            >
              Upload Documents
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {resolvedClient
                ? `Uploading files for ${resolvedClient.name}`
                : 'JPG, PNG, or PDF files up to 5 MB each'}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleStartUpload} className="flex flex-col flex-1 min-h-0">
          <div className="p-6 space-y-5 overflow-y-auto flex-1">
            {validationError && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-800 flex items-start gap-2"
              >
                <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{validationError}</span>
              </div>
            )}

            {/* Client Selector when opened from main /documents page */}
            {!fixedClientId && (
              <div>
                <label
                  htmlFor="upload-client-select"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  Client <span className="text-red-600">*</span>
                </label>
                <select
                  id="upload-client-select"
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  disabled={uploading}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  required
                >
                  <option value="">Select a client...</option>
                  {(clientsList || []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.mobile ? `(${c.mobile})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Category + Note */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="doc-category-select"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  Category <span className="text-red-600">*</span>
                </label>
                <select
                  id="doc-category-select"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  disabled={uploading}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  {DOCUMENT_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="doc-note-input"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  Note (Optional)
                </label>
                <input
                  id="doc-note-input"
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  disabled={uploading}
                  maxLength={500}
                  placeholder="e.g. Front & back scan, attested copy"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            {selectedCategory === 'Other' && (
              <div>
                <label
                  htmlFor="doc-custom-category"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  Custom Category Name (Optional)
                </label>
                <input
                  id="doc-custom-category"
                  type="text"
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  disabled={uploading}
                  maxLength={80}
                  placeholder="e.g. Tax Return, Power of Attorney"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            )}

            {/* Drag-and-Drop / Multi-File Picker */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                if (!uploading) setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragActive(false);
                if (!uploading) handleFilesSelected(e.dataTransfer.files);
              }}
              className={`rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
                dragActive
                  ? 'border-primary bg-blue-50/60'
                  : 'border-slate-300 bg-page hover:border-slate-400'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
                onChange={(e) => {
                  handleFilesSelected(e.target.files);
                  e.target.value = '';
                }}
                disabled={uploading}
                className="hidden"
              />
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-primary">
                <Upload className="h-5 w-5" aria-hidden="true" />
              </div>
              <p className="mt-3 text-sm font-medium text-slate-900">
                Drag and drop files here, or{' '}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="text-primary hover:text-primary-hover underline font-semibold cursor-pointer disabled:opacity-50"
                >
                  browse files
                </button>
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Supports multiple JPG, PNG, and PDF files · Max 5 MB per file
              </p>
            </div>

            {/* File Queue & Individual Progress Bars */}
            {queue.length > 0 && (
              <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                {queue.map((item) => {
                  const isPdf = item.normalizedType === 'application/pdf';
                  return (
                    <div
                      key={item.localId}
                      className={`rounded-lg border p-3 ${
                        item.status === 'error'
                          ? 'border-red-200 bg-red-50/50'
                          : item.status === 'done'
                            ? 'border-emerald-200 bg-emerald-50/40'
                            : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {isPdf ? (
                            <FileText
                              className="h-4 w-4 text-red-600 shrink-0"
                              aria-hidden="true"
                            />
                          ) : (
                            <ImageIcon
                              className="h-4 w-4 text-primary shrink-0"
                              aria-hidden="true"
                            />
                          )}
                          <div className="min-w-0">
                            <div className="text-xs font-medium text-slate-900 truncate">
                              {item.file.name}
                            </div>
                            <div className="text-[11px] font-mono tabular-nums text-slate-500">
                              {formatFileSize(item.file.size)}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {item.status === 'ready' && (
                            <span className="text-xs text-slate-500">Ready</span>
                          )}
                          {item.status === 'uploading' && (
                            <span className="text-xs font-mono tabular-nums text-primary">
                              {item.progress}%
                            </span>
                          )}
                          {item.status === 'saving' && (
                            <span className="inline-flex items-center gap-1 text-xs text-slate-700">
                              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                              Saving...
                            </span>
                          )}
                          {item.status === 'done' && (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                              Uploaded
                            </span>
                          )}
                          {item.status === 'error' && (
                            <span className="text-xs font-medium text-red-700">Failed</span>
                          )}

                          {!uploading && item.status !== 'done' && (
                            <button
                              type="button"
                              onClick={() => removeQueuedFile(item.localId)}
                              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-red-600 cursor-pointer"
                              aria-label={`Remove ${item.file.name}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Progress bar */}
                      {(item.status === 'uploading' ||
                        item.status === 'saving' ||
                        item.status === 'done') && (
                        <div className="mt-2 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className={`h-full transition-all duration-200 ${
                              item.status === 'done' ? 'bg-emerald-600' : 'bg-primary'
                            }`}
                            style={{ width: `${item.progress}%` }}
                          />
                        </div>
                      )}

                      {item.error && (
                        <p className="mt-1.5 text-xs text-red-700">{item.error}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Sticky Modal Footer */}
          <div className="sticky bottom-0 shrink-0 px-6 py-4 border-t border-slate-200 bg-white flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={uploading}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploading || readyOrRetryCount === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50 transition-colors shadow-xs cursor-pointer"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  <span>Uploading...</span>
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" aria-hidden="true" />
                  <span>
                    Upload{' '}
                    {readyOrRetryCount > 0
                      ? `${readyOrRetryCount} ${readyOrRetryCount === 1 ? 'File' : 'Files'}`
                      : 'Files'}
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
