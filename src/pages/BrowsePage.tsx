import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Mic,
  Plus,
  Search,
  X,
} from 'lucide-react';
import { collection, deleteDoc, doc, onSnapshot, writeBatch } from 'firebase/firestore';
import { logBrowseActivity, WebsiteRecord } from '../components/browse/browseTypes';
import { WebsiteCard } from '../components/browse/WebsiteCard';
import { WebsiteFormModal } from '../components/browse/WebsiteFormModal';
import { useAuth } from '../context/AuthContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';

interface ToastState {
  id: number;
  type: 'success' | 'error';
  message: string;
}

/**
 * Determines whether the user's input looks like a URL (contains a dot and no spaces).
 */
function resolveSearchDestination(rawInput: string): string | null {
  const trimmed = rawInput.trim();
  if (!trimmed) return null;

  const looksLikeUrl = trimmed.includes('.') && !/\s/.test(trimmed);
  if (looksLikeUrl) {
    if (/^https?:\/\//i.test(trimmed)) {
      return trimmed;
    }
    return `https://${trimmed}`;
  }

  return `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`;
}

/**
 * Chrome New Tab style Browse page (/browse) with a centered pill search bar,
 * circular shortcut tiles, Super Admin drag-and-drop reordering, and Add/Edit/Delete controls.
 */
export function BrowsePage() {
  const { profile, isSuperAdmin } = useAuth();
  const currentUserEmail = (profile?.email || '').toLowerCase();

  const [websites, setWebsites] = useState<WebsiteRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');

  const [showFormModal, setShowFormModal] = useState(false);
  const [editingWebsite, setEditingWebsite] = useState<WebsiteRecord | null>(null);
  const [deletingWebsite, setDeletingWebsite] = useState<WebsiteRecord | null>(null);
  const [deletingInProgress, setDeletingInProgress] = useState(false);

  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ id: Date.now(), type, message });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  // Subscribe to Firestore websites collection
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'websites'),
      (snapshot) => {
        const list: WebsiteRecord[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<WebsiteRecord, 'id'>),
        }));

        list.sort((a, b) => {
          const orderA = typeof a.sortOrder === 'number' ? a.sortOrder : Number.MAX_SAFE_INTEGER;
          const orderB = typeof b.sortOrder === 'number' ? b.sortOrder : Number.MAX_SAFE_INTEGER;
          if (orderA !== orderB) return orderA - orderB;
          return (a.name || '').localeCompare(b.name || '');
        });

        setWebsites(list);
        setLoading(false);
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.LIST, 'websites');
        } catch {
          showToast('error', 'Unable to load shortcuts. Please check your permissions.');
          setLoading(false);
        }
      }
    );

    return () => unsubscribe();
  }, [showToast]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const destination = resolveSearchDestination(searchInput);
    if (!destination) return;
    window.open(destination, '_blank', 'noopener,noreferrer');
  };

  const handleOpenWebsite = async (website: WebsiteRecord) => {
    window.open(website.url, '_blank', 'noopener,noreferrer');
    try {
      await logBrowseActivity({
        userEmail: currentUserEmail,
        action: 'opened_website',
        websiteName: website.name,
        targetId: website.id,
        details: `Opened website "${website.name}"`,
      });
    } catch {
      // Do not interrupt navigation if activity log write fails
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingWebsite || !isSuperAdmin) return;
    setDeletingInProgress(true);
    const siteToDelete = deletingWebsite;

    try {
      try {
        await deleteDoc(doc(db, 'websites', siteToDelete.id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `websites/${siteToDelete.id}`);
      }

      try {
        await logBrowseActivity({
          userEmail: currentUserEmail,
          action: 'deleted_website',
          websiteName: siteToDelete.name,
          targetId: siteToDelete.id,
          details: `Deleted website "${siteToDelete.name}"`,
        });
      } catch {
        // Non-fatal
      }

      showToast('success', `Shortcut "${siteToDelete.name}" removed.`);
      setDeletingWebsite(null);
    } catch (err) {
      console.error('Failed to delete website:', err);
      showToast('error', 'Unable to delete shortcut. Please try again.');
    } finally {
      setDeletingInProgress(false);
    }
  };

  // Drag-and-drop handlers for Super Admin reordering
  const handleDragStart = (e: React.DragEvent, website: WebsiteRecord) => {
    setDraggedId(website.id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', website.id);
  };

  const handleDragOver = (e: React.DragEvent, website: WebsiteRecord) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (website.id !== draggedId && website.id !== dragOverId) {
      setDragOverId(website.id);
    }
  };

  const handleDrop = async (e: React.DragEvent, targetWebsite: WebsiteRecord) => {
    e.preventDefault();
    const sourceId = draggedId || e.dataTransfer.getData('text/plain');
    setDraggedId(null);
    setDragOverId(null);

    if (!isSuperAdmin || !sourceId || sourceId === targetWebsite.id) return;

    const fromIndex = websites.findIndex((item) => item.id === sourceId);
    const toIndex = websites.findIndex((item) => item.id === targetWebsite.id);
    if (fromIndex === -1 || toIndex === -1) return;

    const reordered = [...websites];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);

    // Optimistic UI update
    const updatedList = reordered.map((item, idx) => ({
      ...item,
      sortOrder: idx + 1,
    }));
    setWebsites(updatedList);

    try {
      const batch = writeBatch(db);
      updatedList.forEach((item, idx) => {
        batch.update(doc(db, 'websites', item.id), { sortOrder: idx + 1 });
      });
      await batch.commit();
    } catch (err) {
      console.error('Failed to save shortcut order:', err);
      showToast('error', 'Unable to save new shortcut order.');
    }
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverId(null);
  };

  const nextSortOrder = useMemo(() => {
    if (websites.length === 0) return 1;
    const maxOrder = websites.reduce(
      (max, site) => (typeof site.sortOrder === 'number' && site.sortOrder > max ? site.sortOrder : max),
      0
    );
    return maxOrder + 1;
  }, [websites]);

  return (
    <div className="min-h-[calc(100vh-8rem)] flex flex-col items-center justify-start pt-10 sm:pt-20 pb-16 px-2">
      {/* Centered Pill Search Bar */}
      <form
        onSubmit={handleSearchSubmit}
        className="w-full max-w-[720px]"
        role="search"
      >
        <div className="flex h-14 items-center gap-3 rounded-full bg-white border border-slate-200/80 px-5 shadow-md hover:shadow-lg focus-within:shadow-lg focus-within:border-[#2563EB]/40 transition-shadow">
          {/* Decorative Left Plus Icon */}
          <Plus className="h-5 w-5 text-slate-400 shrink-0" aria-hidden="true" />

          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search Google or type a URL"
            aria-label="Search Google or type a URL"
            className="flex-1 bg-transparent text-sm sm:text-base text-slate-900 placeholder:text-slate-400 focus:outline-none min-w-0"
          />

          {/* Decorative Right Microphone Icon */}
          <Mic className="h-5 w-5 text-slate-400 shrink-0" aria-hidden="true" />

          {/* Clickable Search Submit Icon */}
          <button
            type="submit"
            aria-label="Search"
            className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-[#2563EB]/10 hover:text-[#2563EB] transition-colors shrink-0 cursor-pointer"
          >
            <Search className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </form>

      {/* Shortcuts Grid Area (no surrounding card or box) */}
      <section
        aria-label="Shortcuts"
        className="w-full max-w-4xl mt-12 sm:mt-14"
      >
        {loading ? (
          <div
            className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-8 gap-x-2 gap-y-4"
            aria-busy="true"
            aria-label="Loading shortcuts"
          >
            {[1, 2, 3, 4, 5, 6, 7, 8].map((item) => (
              <div key={item} className="flex flex-col items-center gap-2.5 py-3.5 px-2">
                <div className="h-16 w-16 rounded-full bg-slate-200/75 animate-pulse" />
                <div className="h-3.5 w-16 rounded bg-slate-200/75 animate-pulse" />
              </div>
            ))}
          </div>
        ) : websites.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-6">
            <p className="text-sm font-medium text-slate-500">No shortcuts yet</p>
            {isSuperAdmin && (
              <div className="mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setEditingWebsite(null);
                    setShowFormModal(true);
                  }}
                  className="group flex flex-col items-center gap-2.5 rounded-2xl px-4 py-3.5 hover:-translate-y-0.5 hover:bg-slate-200/55 transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB]"
                >
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#2563EB]/10 text-[#2563EB] group-hover:bg-[#2563EB]/15 transition-colors">
                    <Plus className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <span className="text-sm font-medium text-slate-800 whitespace-nowrap">
                    Add shortcut
                  </span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-8 gap-x-2 gap-y-4">
            {websites.map((website) => (
              <WebsiteCard
                key={website.id}
                website={website}
                isSuperAdmin={isSuperAdmin}
                isDragging={draggedId === website.id}
                isDragOver={dragOverId === website.id}
                onOpen={handleOpenWebsite}
                onEdit={(site) => {
                  setEditingWebsite(site);
                  setShowFormModal(true);
                }}
                onDelete={(site) => setDeletingWebsite(site)}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onDragEnd={handleDragEnd}
              />
            ))}

            {/* Last Tile: Add Shortcut (Super Admin Only) */}
            {isSuperAdmin && (
              <button
                type="button"
                onClick={() => {
                  setEditingWebsite(null);
                  setShowFormModal(true);
                }}
                className="group flex flex-col items-center gap-2.5 rounded-2xl px-2 py-3.5 hover:-translate-y-0.5 hover:bg-slate-200/55 transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB]"
              >
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#2563EB]/10 text-[#2563EB] group-hover:bg-[#2563EB]/15 transition-colors">
                  <Plus className="h-6 w-6" aria-hidden="true" />
                </div>
                <span className="w-full px-1 text-center text-sm font-medium text-slate-800 truncate">
                  Add shortcut
                </span>
              </button>
            )}
          </div>
        )}
      </section>

      {/* Add / Edit Website Modal (Super Admin Only) */}
      {showFormModal && isSuperAdmin && (
        <WebsiteFormModal
          existingWebsite={editingWebsite}
          defaultSortOrder={nextSortOrder}
          currentUserEmail={currentUserEmail}
          onClose={() => {
            setShowFormModal(false);
            setEditingWebsite(null);
          }}
          onSuccess={(msg) => showToast('success', msg)}
          onError={(msg) => showToast('error', msg)}
        />
      )}

      {/* Delete Confirmation Modal (Super Admin Only) */}
      {deletingWebsite && isSuperAdmin && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-[1px] p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-website-title"
        >
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
            <div className="p-6">
              <h2 id="delete-website-title" className="text-base font-semibold text-slate-900">
                Remove Shortcut
              </h2>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Are you sure you want to remove{' '}
                <span className="font-semibold text-slate-900">{deletingWebsite.name}</span>? This
                action cannot be undone.
              </p>
            </div>
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeletingWebsite(null)}
                disabled={deletingInProgress}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deletingInProgress}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60 transition-colors shadow-xs cursor-pointer"
              >
                {deletingInProgress ? 'Removing...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-5 right-5 z-[60] max-w-md rounded-lg border px-4 py-3 shadow-lg flex items-start gap-3 ${
            toast.type === 'success'
              ? 'bg-white border-emerald-200 text-slate-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2
              className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5"
              aria-hidden="true"
            />
          ) : (
            <AlertCircle
              className="h-5 w-5 text-red-600 shrink-0 mt-0.5"
              aria-hidden="true"
            />
          )}
          <p className="text-sm flex-1">{toast.message}</p>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-slate-400 hover:text-slate-700 shrink-0 cursor-pointer"
            aria-label="Dismiss notification"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
