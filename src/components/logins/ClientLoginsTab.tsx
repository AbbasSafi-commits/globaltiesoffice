import { useEffect, useState } from 'react';
import { KeyRound, Plus } from 'lucide-react';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { LoginFormModal } from './LoginFormModal';
import { PortalLoginCard } from './PortalLoginCard';
import { logPortalLoginActivity, PortalLoginRecord } from './loginTypes';

interface ClientLoginsTabProps {
  clientId: string;
  clientName: string;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}

/**
 * Logins tab inside the Client Profile page backed by Firestore "portalLogins".
 */
export function ClientLoginsTab({
  clientId,
  clientName,
  onSuccess,
  onError,
}: ClientLoginsTabProps) {
  const { profile, can } = useAuth();
  const currentUserEmail = (profile?.email || '').toLowerCase();

  const canAdd = can('portal_logins', 'add');
  const canEdit = can('portal_logins', 'edit');
  const canDelete = can('portal_logins', 'delete');

  const [logins, setLogins] = useState<PortalLoginRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingLogin, setEditingLogin] = useState<PortalLoginRecord | null>(null);
  const [deletingLogin, setDeletingLogin] = useState<PortalLoginRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const loginsQuery = query(
      collection(db, 'portalLogins'),
      where('clientId', '==', clientId)
    );

    const unsubscribe = onSnapshot(
      loginsQuery,
      (snapshot) => {
        const items: PortalLoginRecord[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<PortalLoginRecord, 'id'>),
        }));

        items.sort((a, b) => {
          const aTime =
            a.createdAt && typeof a.createdAt.toDate === 'function'
              ? a.createdAt.toDate().getTime()
              : 0;
          const bTime =
            b.createdAt && typeof b.createdAt.toDate === 'function'
              ? b.createdAt.toDate().getTime()
              : 0;
          return bTime - aTime;
        });

        setLogins(items);
        setLoading(false);
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.LIST, 'portalLogins');
        } catch {
          onError('Unable to load portal logins. Please check your permissions.');
          setLoading(false);
        }
      }
    );

    return () => unsubscribe();
  }, [clientId, onError]);

  const handleConfirmDelete = async () => {
    if (!deletingLogin || !canDelete) return;
    setDeleting(true);
    const docPath = `portalLogins/${deletingLogin.id}`;

    try {
      try {
        await deleteDoc(doc(db, 'portalLogins', deletingLogin.id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, docPath);
      }

      await logPortalLoginActivity({
        userEmail: currentUserEmail,
        action: 'deleted_portal_login',
        clientId,
        websiteName: deletingLogin.departmentName,
        targetId: deletingLogin.id,
        details: `Deleted portal login "${deletingLogin.departmentName}" for client "${clientName}"`,
      });

      onSuccess(`Portal login "${deletingLogin.departmentName}" deleted.`);
      setDeletingLogin(null);
    } catch (err) {
      console.error('Failed to delete portal login:', err instanceof Error ? err.message : 'Error');
      onError('Could not delete portal login due to a Firestore permission error.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Portal Logins ({logins.length})
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Passwords and PINs are masked by default. Reveals auto-hide after 10 seconds and are recorded in the audit log.
          </p>
        </div>

        {canAdd && (
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-medium text-white hover:bg-primary-hover transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>Add Login</span>
          </button>
        )}
      </div>

      {loading ? (
        <div className="space-y-4" aria-busy="true" aria-label="Loading portal logins">
          {[1, 2].map((card) => (
            <div
              key={card}
              className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden animate-pulse"
            >
              <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
                <div className="space-y-2">
                  <div className="h-4 w-44 rounded bg-slate-200" />
                  <div className="h-3 w-56 rounded bg-slate-100" />
                </div>
                <div className="h-7 w-24 rounded-lg bg-slate-200" />
              </div>
              <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-5">
                {[1, 2, 3].map((col) => (
                  <div key={col} className="space-y-2">
                    <div className="h-3 w-20 rounded bg-slate-100" />
                    <div className="h-9 w-full rounded-lg bg-slate-100" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : logins.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs px-6 py-12 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
            <KeyRound className="h-5 w-5" aria-hidden="true" />
          </div>
          <p className="text-sm font-medium text-slate-900">
            No portal logins saved for this client.
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Save portal links, usernames, passwords, and PIN codes securely for authorized staff.
          </p>
          {canAdd && (
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover transition-colors cursor-pointer"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span>Add First Login</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {logins.map((login) => (
            <PortalLoginCard
              key={login.id}
              login={login}
              clientId={clientId}
              clientName={clientName}
              currentUserEmail={currentUserEmail}
              canEdit={canEdit}
              canDelete={canDelete}
              onEditClick={(item) => setEditingLogin(item)}
              onDeleteClick={(item) => setDeletingLogin(item)}
              onSuccess={onSuccess}
              onError={onError}
            />
          ))}
        </div>
      )}

      {/* Add Login Modal */}
      {showAddModal && canAdd && (
        <LoginFormModal
          clientId={clientId}
          clientName={clientName}
          currentUserEmail={currentUserEmail}
          onClose={() => setShowAddModal(false)}
          onSuccess={onSuccess}
          onError={onError}
        />
      )}

      {/* Edit Login Modal */}
      {editingLogin && canEdit && (
        <LoginFormModal
          clientId={clientId}
          clientName={clientName}
          existingLogin={editingLogin}
          currentUserEmail={currentUserEmail}
          onClose={() => setEditingLogin(null)}
          onSuccess={onSuccess}
          onError={onError}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {deletingLogin && canDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-[1px] p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-login-title"
        >
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl shadow-xl p-6 space-y-4">
            <h3
              id="delete-login-title"
              className="text-base font-semibold text-slate-900"
            >
              Delete login for &ldquo;{deletingLogin.departmentName}&rdquo;?
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              This permanently removes this portal credential from {clientName}&apos;s profile.
            </p>
            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeletingLogin(null)}
                disabled={deleting}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60 transition-colors cursor-pointer"
              >
                {deleting ? 'Deleting...' : 'Delete Login'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
