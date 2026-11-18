import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Download,
  ExternalLink,
  Eye,
  FileText,
  FolderOpen,
  Image as ImageIcon,
  LayoutGrid,
  List,
  Loader2,
  Search,
  Trash2,
} from 'lucide-react';
import { ClientRecord } from '../clients/clientTypes';
import { DocumentPreviewModal } from './DocumentPreviewModal';
import {
  deleteDocumentWithChunks,
  DOCUMENT_CATEGORIES,
  DocumentRecord,
  formatDocumentDate,
  formatFileSize,
  formatSmartFileName,
  getDocumentTypeLabel,
  getFriendlyDocumentError,
  isImageDocument,
  logDocumentActivity,
  openDocumentObjectUrlInNewTab,
  readDocumentChunksToBlob,
  triggerBrowserObjectUrlDownload,
} from './documentTypes';

interface DocumentListSectionProps {
  documents: DocumentRecord[];
  loading: boolean;
  currentUserEmail: string;
  canDelete: boolean;
  showClientColumn?: boolean;
  clientsMap?: Record<string, ClientRecord>;
  emptyTitle?: string;
  emptySubtitle?: string;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}

/**
 * Reusable document archive list (Table & Grid views) with search, category filter,
 * on-demand View / Download from Firestore chunks, Delete confirmation, and activity logging.
 */
export function DocumentListSection({
  documents,
  loading,
  currentUserEmail,
  canDelete,
  showClientColumn = false,
  clientsMap = {},
  emptyTitle = 'No documents uploaded yet',
  emptySubtitle = 'Upload JPG, PNG, or PDF files to build a secure document archive.',
  onSuccess,
  onError,
}: DocumentListSectionProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

  const [busyAction, setBusyAction] = useState<{
    id: string;
    type: 'view' | 'download';
    fileName: string;
  } | null>(null);

  const [previewData, setPreviewData] = useState<{
    item: DocumentRecord;
    url: string;
  } | null>(null);

  const [deletingDoc, setDeletingDoc] = useState<DocumentRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Revoke any active image preview Object URL if the component unmounts
  useEffect(() => {
    const activeUrl = previewData?.url;
    return () => {
      if (activeUrl) {
        URL.revokeObjectURL(activeUrl);
      }
    };
  }, [previewData?.url]);

  const closePreviewModal = () => {
    setPreviewData(null);
  };

  const resolveClientName = (item: DocumentRecord): string => {
    return clientsMap[item.clientId]?.name || item.clientName || 'Client';
  };

  // Combine standard categories with any custom categories present in data
  const categoryOptions = useMemo(() => {
    const set = new Set<string>(DOCUMENT_CATEGORIES);
    documents.forEach((item) => {
      if (item.category) set.add(item.category);
    });
    return Array.from(set);
  }, [documents]);

  // Sort newest first, then filter by category and search query
  const filteredDocs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return [...documents]
      .sort((a, b) => {
        const aTime =
          a.createdAt && typeof a.createdAt.toDate === 'function'
            ? a.createdAt.toDate().getTime()
            : 0;
        const bTime =
          b.createdAt && typeof b.createdAt.toDate === 'function'
            ? b.createdAt.toDate().getTime()
            : 0;
        return bTime - aTime;
      })
      .filter((item) => {
        if (categoryFilter !== 'All' && item.category !== categoryFilter) {
          return false;
        }
        if (!q) return true;
        const clientName = resolveClientName(item).toLowerCase();
        return (
          item.fileName.toLowerCase().includes(q) ||
          (item.note || '').toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q) ||
          (showClientColumn && clientName.includes(q))
        );
      });
  }, [documents, categoryFilter, searchQuery, showClientColumn, clientsMap]);

  const handleView = async (item: DocumentRecord) => {
    setBusyAction({ id: item.id, type: 'view', fileName: item.fileName });
    try {
      const blob = await readDocumentChunksToBlob(item.id, item.fileType);
      const objectUrl = URL.createObjectURL(blob);
      const clientLabel = resolveClientName(item);

      // Log view event
      try {
        await logDocumentActivity({
          userEmail: currentUserEmail,
          action: 'viewed_document',
          clientId: item.clientId,
          targetId: item.id,
          details: `Viewed "${item.fileName}" (${item.category}) for "${clientLabel}"`,
        });
      } catch {
        // Non-blocking audit log write
      }

      if (isImageDocument(item.fileType, item.fileName)) {
        setPreviewData({ item, url: objectUrl });
      } else {
        openDocumentObjectUrlInNewTab(objectUrl);
        onSuccess(`Opened "${item.fileName}" in a new tab.`);
      }
    } catch (err) {
      onError(getFriendlyDocumentError(err, `view "${item.fileName}"`));
    } finally {
      setBusyAction(null);
    }
  };

  const handleDownload = async (item: DocumentRecord) => {
    setBusyAction({ id: item.id, type: 'download', fileName: item.fileName });
    try {
      const blob = await readDocumentChunksToBlob(item.id, item.fileType);
      const objectUrl = URL.createObjectURL(blob);
      const clientLabel = resolveClientName(item);

      triggerBrowserObjectUrlDownload(objectUrl, item.fileName);

      try {
        await logDocumentActivity({
          userEmail: currentUserEmail,
          action: 'downloaded_document',
          clientId: item.clientId,
          targetId: item.id,
          details: `Downloaded "${item.fileName}" (${item.category}) for "${clientLabel}"`,
        });
      } catch {
        // Non-blocking audit log write
      }

      onSuccess(`Downloading "${item.fileName}".`);
    } catch (err) {
      onError(getFriendlyDocumentError(err, `download "${item.fileName}"`));
    } finally {
      setBusyAction(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingDoc || !canDelete) return;
    setDeleting(true);
    const clientLabel = resolveClientName(deletingDoc);

    try {
      // 1. Delete all chunk documents in subcollection first, then delete metadata document
      await deleteDocumentWithChunks(deletingDoc.id);

      // 2. Log deletion in activityLog
      try {
        await logDocumentActivity({
          userEmail: currentUserEmail,
          action: 'deleted_document',
          clientId: deletingDoc.clientId,
          targetId: deletingDoc.id,
          details: `Deleted "${deletingDoc.fileName}" (${deletingDoc.category}) for "${clientLabel}"`,
        });
      } catch {
        // Non-blocking audit log write
      }

      onSuccess(`Deleted "${deletingDoc.fileName}".`);
      setDeletingDoc(null);
    } catch (err) {
      onError(getFriendlyDocumentError(err, `delete "${deletingDoc.fileName}"`));
    } finally {
      setDeleting(false);
    }
  };

  const getInitials = (name: string): string => {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  };

  return (
    <>
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        {/* Filter Bar */}
        <div className="p-4 sm:px-6 sm:py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex flex-1 flex-col sm:flex-row sm:items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search
                className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  showClientColumn
                    ? 'Search file name, client, or note...'
                    : 'Search file name or note...'
                }
                aria-label="Search documents"
                className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              aria-label="Filter by category"
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="All">All Categories</option>
              {categoryOptions.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Table / Grid toggle */}
          <div
            className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5 self-start sm:self-auto"
            role="group"
            aria-label="Document view mode"
          >
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white text-primary shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              aria-pressed={viewMode === 'table'}
            >
              <List className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Table</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-white text-primary shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              aria-pressed={viewMode === 'grid'}
            >
              <LayoutGrid className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Grid</span>
            </button>
          </div>
        </div>

        {busyAction && (
          <div
            role="status"
            aria-live="polite"
            className="px-6 py-2.5 border-b border-blue-100 bg-blue-50/70 flex items-center gap-2 text-xs font-medium text-primary"
          >
            <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" aria-hidden="true" />
            <span>
              Loading document chunks for &ldquo;{busyAction.fileName}&rdquo;...
            </span>
          </div>
        )}

        {/* Body */}
        {loading ? (
          <div className="p-6 space-y-3" aria-busy="true" aria-label="Loading documents">
            {[1, 2, 3].map((row) => (
              <div key={row} className="h-12 w-full rounded-lg bg-slate-100 animate-pulse" />
            ))}
          </div>
        ) : documents.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-500">
              <FolderOpen className="h-5 w-5" aria-hidden="true" />
            </div>
            <p className="mt-3 text-sm font-medium text-slate-900">{emptyTitle}</p>
            <p className="mt-1 text-sm text-slate-500">{emptySubtitle}</p>
          </div>
        ) : filteredDocs.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-500">
              <Search className="h-5 w-5" aria-hidden="true" />
            </div>
            <p className="text-sm font-medium text-slate-900">No matching documents found</p>
            <p className="mt-1 text-sm text-slate-500">
              Try clearing your search or selecting a different category.
            </p>
          </div>
        ) : viewMode === 'table' ? (
          <div className="overflow-x-auto overflow-y-auto max-h-[600px]">
            <table className="w-full min-w-[900px] table-fixed text-left text-sm">
              <colgroup>
                <col className={showClientColumn ? 'w-[30%]' : 'w-[44%]'} />
                {showClientColumn && <col className="w-[18%]" />}
                <col className={showClientColumn ? 'w-[12%]' : 'w-[14%]'} />
                <col className="hidden md:table-column w-[8%]" />
                <col className="hidden md:table-column w-[14%]" />
                <col className="w-[10%]" />
                <col className="w-[8%] min-w-[128px]" />
              </colgroup>
              <thead className="sticky top-0 z-10 bg-table-head border-b border-border">
                <tr className="text-xs font-medium text-slate-500">
                  <th className="px-4 py-3.5">Document</th>
                  {showClientColumn && <th className="px-4 py-3.5">Client</th>}
                  <th className="px-4 py-3.5">Category</th>
                  <th className="hidden md:table-cell px-4 py-3.5 whitespace-nowrap">Size</th>
                  <th className="hidden md:table-cell px-4 py-3.5">Uploaded By</th>
                  <th className="px-4 py-3.5 whitespace-nowrap">Date</th>
                  <th className="px-4 py-3.5 text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDocs.map((item) => {
                  const isImg = isImageDocument(item.fileType, item.fileName);
                  const isViewing = busyAction?.id === item.id && busyAction.type === 'view';
                  const isDownloading =
                    busyAction?.id === item.id && busyAction.type === 'download';
                  const clientName = resolveClientName(item);
                  const typeLabel = getDocumentTypeLabel(item.fileType, item.fileName);

                  return (
                    <tr
                      key={item.id}
                      className="h-16 hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="px-4 py-2 align-middle">
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                              isImg
                                ? 'bg-blue-50 text-primary'
                                : 'bg-red-50 text-red-600'
                            }`}
                          >
                            {isImg ? (
                              <ImageIcon className="h-4 w-4" aria-hidden="true" />
                            ) : (
                              <FileText className="h-4 w-4" aria-hidden="true" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div
                              title={item.fileName}
                              className="font-medium text-slate-900 truncate"
                            >
                              {formatSmartFileName(item.fileName)}
                            </div>
                            <div
                              title={item.note ? `${typeLabel} · ${formatFileSize(item.size)} · ${item.note}` : `${typeLabel} · ${formatFileSize(item.size)}`}
                              className="text-xs text-slate-500 truncate mt-0.5"
                            >
                              {typeLabel} · {formatFileSize(item.size)}
                              {item.note ? ` · ${item.note}` : ''}
                            </div>
                          </div>
                        </div>
                      </td>

                      {showClientColumn && (
                        <td className="px-4 py-2 align-middle">
                          <Link
                            to={`/clients/${item.clientId}?tab=documents`}
                            title={clientName}
                            className="flex items-center gap-2 min-w-0 text-sm font-medium text-slate-800 hover:text-primary group"
                          >
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-semibold text-slate-600 group-hover:bg-blue-50 group-hover:text-primary">
                              {getInitials(clientName)}
                            </span>
                            <span className="truncate">{clientName}</span>
                            <ExternalLink
                              className="h-3 w-3 text-slate-400 shrink-0 group-hover:text-primary"
                              aria-hidden="true"
                            />
                          </Link>
                        </td>
                      )}

                      <td className="px-4 py-2 align-middle">
                        <span
                          title={item.category}
                          className="inline-block max-w-full truncate rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 align-middle"
                        >
                          {item.category}
                        </span>
                      </td>

                      <td className="hidden md:table-cell px-4 py-2 align-middle font-mono text-xs tabular-nums text-slate-600 whitespace-nowrap">
                        {formatFileSize(item.size)}
                      </td>

                      <td className="hidden md:table-cell px-4 py-2 align-middle">
                        <div
                          title={item.uploadedBy}
                          className="font-mono text-xs text-slate-600 truncate"
                        >
                          {item.uploadedBy}
                        </div>
                      </td>

                      <td className="px-4 py-2 align-middle font-mono text-xs tabular-nums text-slate-600 whitespace-nowrap">
                        {formatDocumentDate(item.createdAt)}
                      </td>

                      <td className="px-4 py-2 align-middle text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1 flex-nowrap">
                          <button
                            type="button"
                            onClick={() => handleView(item)}
                            disabled={busyAction !== null}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                            title={isImg ? 'Preview image' : 'Open PDF in new tab'}
                          >
                            {isViewing ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" aria-hidden="true" />
                            ) : (
                              <Eye className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            )}
                            <span>View</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDownload(item)}
                            disabled={busyAction !== null}
                            className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-1.5 text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors shrink-0 cursor-pointer"
                            title="Download document"
                            aria-label={`Download ${item.fileName}`}
                          >
                            {isDownloading ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                            ) : (
                              <Download className="h-3.5 w-3.5" aria-hidden="true" />
                            )}
                          </button>

                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => setDeletingDoc(item)}
                              disabled={busyAction !== null}
                              className="inline-flex items-center justify-center rounded-lg border border-red-200 bg-white p-1.5 text-red-700 hover:bg-red-50 disabled:opacity-50 transition-colors shrink-0 cursor-pointer"
                              title="Delete document"
                              aria-label={`Delete ${item.fileName}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* Grid View */
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDocs.map((item) => {
              const isImg = isImageDocument(item.fileType, item.fileName);
              const isViewing = busyAction?.id === item.id && busyAction.type === 'view';
              const isDownloading =
                busyAction?.id === item.id && busyAction.type === 'download';
              const clientName = resolveClientName(item);

              return (
                <article
                  key={item.id}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs flex flex-col justify-between gap-4 hover:border-slate-300 transition-colors min-w-0"
                >
                  <div className="space-y-3 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                          isImg
                            ? 'bg-blue-50 text-primary'
                            : 'bg-red-50 text-red-600'
                        }`}
                      >
                        {isImg ? (
                          <ImageIcon className="h-5 w-5" aria-hidden="true" />
                        ) : (
                          <FileText className="h-5 w-5" aria-hidden="true" />
                        )}
                      </div>
                      <span
                        title={item.category}
                        className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 max-w-[60%] truncate"
                      >
                        {item.category}
                      </span>
                    </div>

                    <div className="min-w-0">
                      <h3
                        title={item.fileName}
                        className="text-sm font-semibold text-slate-900 line-clamp-2 break-words"
                      >
                        {formatSmartFileName(item.fileName, 48)}
                      </h3>
                      {showClientColumn && (
                        <Link
                          to={`/clients/${item.clientId}?tab=documents`}
                          title={clientName}
                          className="mt-1 inline-flex items-center gap-1 max-w-full text-xs font-medium text-primary hover:underline"
                        >
                          <span className="truncate">{clientName}</span>
                          <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                        </Link>
                      )}
                      {item.note && (
                        <p className="mt-1 text-xs text-slate-500 line-clamp-2 break-words">
                          {item.note}
                        </p>
                      )}
                    </div>

                    <div className="text-xs text-slate-500 space-y-1 border-t border-slate-100 pt-2.5">
                      <div className="flex items-center justify-between">
                        <span>Size</span>
                        <span className="font-mono tabular-nums text-slate-700">
                          {formatFileSize(item.size)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Date</span>
                        <span className="font-mono tabular-nums text-slate-700">
                          {formatDocumentDate(item.createdAt)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span>By</span>
                        <span className="font-mono text-slate-700 truncate">
                          {item.uploadedBy}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => handleView(item)}
                      disabled={busyAction !== null}
                      className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors cursor-pointer"
                    >
                      {isViewing ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      ) : (
                        <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      <span>View</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDownload(item)}
                      disabled={busyAction !== null}
                      className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors cursor-pointer"
                    >
                      {isDownloading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      ) : (
                        <Download className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      <span>Download</span>
                    </button>

                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => setDeletingDoc(item)}
                        disabled={busyAction !== null}
                        className="inline-flex items-center justify-center rounded-lg border border-red-200 bg-white p-1.5 text-red-700 hover:bg-red-50 disabled:opacity-50 transition-colors cursor-pointer"
                        aria-label={`Delete ${item.fileName}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* Image Preview Modal */}
      {previewData && (
        <DocumentPreviewModal
          documentItem={previewData.item}
          previewUrl={previewData.url}
          onClose={closePreviewModal}
          onDownload={handleDownload}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deletingDoc && canDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-[1px] p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-doc-title"
        >
          <div className="w-full max-w-md bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden">
            <div className="p-6 space-y-2">
              <h3
                id="delete-doc-title"
                className="text-base font-semibold text-slate-900"
              >
                Delete Document
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Are you sure you want to delete{' '}
                <span className="font-medium text-slate-900 break-all max-w-full">
                  {deletingDoc.fileName}
                </span>{' '}
                ({deletingDoc.category})? This will permanently remove the document and
                all of its stored data from Firestore.
              </p>
            </div>
            <div className="px-6 py-4 bg-slate-50/80 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeletingDoc(null)}
                disabled={deleting}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 transition-colors cursor-pointer"
              >
                {deleting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                <span>{deleting ? 'Deleting...' : 'Delete Document'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
