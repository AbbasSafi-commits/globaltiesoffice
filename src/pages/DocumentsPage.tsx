import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Upload, X } from 'lucide-react';
import { collection, onSnapshot } from 'firebase/firestore';
import { ClientRecord } from '../components/clients/clientTypes';
import { DocumentListSection } from '../components/documents/DocumentListSection';
import { DocumentUploadModal } from '../components/documents/DocumentUploadModal';
import { DocumentRecord } from '../components/documents/documentTypes';
import { useAuth } from '../context/AuthContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';

interface ToastState {
  id: number;
  type: 'success' | 'error';
  message: string;
}

/**
 * Main Documents overview page (/documents) showing all documents across clients
 * with search, category filtering, on-demand View/Download, Delete, and optional Upload.
 */
export function DocumentsPage() {
  const { profile, can } = useAuth();
  const currentUserEmail = (profile?.email || '').toLowerCase();

  const canAdd = can('documents', 'add');
  const canDelete = can('documents', 'delete');
  const canViewClients = can('clients', 'view');

  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [clientsMap, setClientsMap] = useState<Record<string, ClientRecord>>({});
  const [clientsList, setClientsList] = useState<ClientRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ id: Date.now(), type, message });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  // Subscribe to all document metadata records
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'documents'),
      (snapshot) => {
        const list: DocumentRecord[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<DocumentRecord, 'id'>),
        }));
        setDocuments(list);
        setLoading(false);
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.LIST, 'documents');
        } catch {
          showToast('error', 'Unable to load documents. Please check your permissions.');
          setLoading(false);
        }
      }
    );

    return () => unsubscribe();
  }, [showToast]);

  // Enrich with client names and provide client selector for upload when permitted
  useEffect(() => {
    if (!canViewClients) return;

    const unsubscribe = onSnapshot(
      collection(db, 'clients'),
      (snapshot) => {
        const map: Record<string, ClientRecord> = {};
        const list: ClientRecord[] = [];
        for (const docSnap of snapshot.docs) {
          const item: ClientRecord = {
            id: docSnap.id,
            ...(docSnap.data() as Omit<ClientRecord, 'id'>),
          };
          map[docSnap.id] = item;
          list.push(item);
        }
        list.sort((a, b) => a.name.localeCompare(b.name));
        setClientsMap(map);
        setClientsList(list);
      },
      () => {
        // Non-fatal: document records already store clientName fallback
      }
    );

    return () => unsubscribe();
  }, [canViewClients]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
            Documents
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Central archive of client scans, identity documents, and PDF records across Global Ties Office.
          </p>
        </div>

        {canAdd && canViewClients && (
          <button
            type="button"
            onClick={() => setShowUploadModal(true)}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#2563EB] px-4 py-2 text-sm font-medium text-white hover:bg-[#1D4ED8] transition-colors whitespace-nowrap shrink-0 self-start sm:self-auto shadow-xs cursor-pointer"
          >
            <Upload className="h-4 w-4" aria-hidden="true" />
            <span>Upload Documents</span>
          </button>
        )}
      </div>

      {/* Document Archive */}
      <DocumentListSection
        documents={documents}
        loading={loading}
        currentUserEmail={currentUserEmail}
        canDelete={canDelete}
        showClientColumn={true}
        clientsMap={clientsMap}
        emptyTitle="No documents archived yet"
        emptySubtitle="Open a client profile or click Upload Documents to add JPG, PNG, or PDF files."
        onSuccess={(msg) => showToast('success', msg)}
        onError={(msg) => showToast('error', msg)}
      />

      {/* Upload Modal (from main page with client picker) */}
      {showUploadModal && canAdd && (
        <DocumentUploadModal
          clientsList={clientsList}
          currentUserEmail={currentUserEmail}
          onClose={() => setShowUploadModal(false)}
          onSuccess={(msg) => showToast('success', msg)}
          onError={(msg) => showToast('error', msg)}
        />
      )}

      {/* Toast Notification */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-5 right-5 z-50 max-w-md rounded-lg border px-4 py-3 shadow-lg flex items-start gap-3 ${
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
