import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';
import {
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore';
import { ClientFormModal } from '../components/clients/ClientFormModal';
import { ClientTable } from '../components/clients/ClientTable';
import { ClientRecord, logClientActivity } from '../components/clients/clientTypes';
import { useAuth } from '../context/AuthContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';

const PAGE_SIZE = 25;

interface ToastState {
  id: number;
  type: 'success' | 'error';
  message: string;
}

/**
 * Clients module page (/clients) backed by Firestore "clients" collection
 * with permission-aware UI controls, pagination, search, filters, and audit logging.
 */
export function ClientsPage() {
  const { profile, can } = useAuth();
  const navigate = useNavigate();
  const currentUserEmail = (profile?.email || '').toLowerCase();

  const canAdd = can('clients', 'add');
  const canEdit = can('clients', 'edit');
  const canDelete = can('clients', 'delete');

  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [fetchLimit, setFetchLimit] = useState(PAGE_SIZE);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientRecord | null>(null);
  const [deletingClient, setDeletingClient] = useState<ClientRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ id: Date.now(), type, message });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => {
      setToast(null);
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  // Subscribe to newest-first client records (25 at a time)
  useEffect(() => {
    const clientsQuery = query(
      collection(db, 'clients'),
      orderBy('createdAt', 'desc'),
      limit(fetchLimit + 1)
    );

    const unsubscribe = onSnapshot(
      clientsQuery,
      (snapshot) => {
        const docs = snapshot.docs;
        const moreAvailable = docs.length > fetchLimit;
        const slicedDocs = moreAvailable ? docs.slice(0, fetchLimit) : docs;

        const items: ClientRecord[] = slicedDocs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<ClientRecord, 'id'>),
        }));

        setClients(items);
        setHasMore(moreAvailable);
        setLoading(false);
        setLoadingMore(false);
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.LIST, 'clients');
        } catch {
          showToast('error', 'Unable to load clients. Please check your permissions.');
          setLoading(false);
          setLoadingMore(false);
        }
      }
    );

    return () => unsubscribe();
  }, [fetchLimit, showToast]);

  const handleLoadMore = () => {
    setLoadingMore(true);
    setFetchLimit((prev) => prev + PAGE_SIZE);
  };

  const handleConfirmDelete = async () => {
    if (!deletingClient || !canDelete) return;
    setDeleting(true);
    const clientPath = `clients/${deletingClient.id}`;

    try {
      try {
        await deleteDoc(doc(db, 'clients', deletingClient.id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, clientPath);
      }

      await logClientActivity({
        userEmail: currentUserEmail,
        action: 'deleted_client',
        targetId: deletingClient.id,
        details: `Deleted client "${deletingClient.name}" (${deletingClient.clientType})`,
      });

      showToast('success', `Client "${deletingClient.name}" deleted.`);
      setDeletingClient(null);
    } catch (err) {
      console.error('Failed to delete client:', err);
      showToast('error', 'Could not delete client due to a Firestore permission error.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-[#0F2942] tracking-tight">
          Clients
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Manage client personal records, identity documents, classifications, and status.
        </p>
      </div>

      <ClientTable
        clients={clients}
        loading={loading}
        hasMore={hasMore}
        loadingMore={loadingMore}
        onLoadMore={handleLoadMore}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        typeFilter={typeFilter}
        onTypeFilterChange={setTypeFilter}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        canAdd={canAdd}
        canEdit={canEdit}
        canDelete={canDelete}
        onAddClick={() => setShowAddModal(true)}
        onViewClick={(c) => navigate(`/clients/${c.id}`)}
        onEditClick={(c) => setEditingClient(c)}
        onDeleteClick={(c) => setDeletingClient(c)}
      />

      {/* Add Client Modal */}
      {showAddModal && canAdd && (
        <ClientFormModal
          currentUserEmail={currentUserEmail}
          onClose={() => setShowAddModal(false)}
          onSuccess={(msg) => showToast('success', msg)}
          onError={(msg) => showToast('error', msg)}
        />
      )}

      {/* Edit Client Modal */}
      {editingClient && canEdit && (
        <ClientFormModal
          existingClient={editingClient}
          currentUserEmail={currentUserEmail}
          onClose={() => setEditingClient(null)}
          onSuccess={(msg) => showToast('success', msg)}
          onError={(msg) => showToast('error', msg)}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {deletingClient && canDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-client-title"
        >
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl shadow-xl p-6 space-y-4">
            <h2
              id="delete-client-title"
              className="font-display text-base font-semibold text-slate-900"
            >
              Delete {deletingClient.name}?
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              This permanently removes this client record from the office directory. This action will be recorded in the activity log.
            </p>
            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeletingClient(null)}
                disabled={deleting}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-60 transition-colors cursor-pointer"
              >
                {deleting ? 'Deleting...' : 'Delete Client'}
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
