import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { ActivityLog } from '../components/permissions/ActivityLog';
import { EditPermissionsModal } from '../components/permissions/EditPermissionsModal';
import { InviteModal } from '../components/permissions/InviteModal';
import { UserTable } from '../components/permissions/UserTable';
import { logPermissionActivity } from '../components/permissions/activityLogger';
import { StaffProfile, useAuth } from '../context/AuthContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';

type ActiveTab = 'users' | 'activity';

interface ToastState {
  id: number;
  type: 'success' | 'error';
  message: string;
}

type ConfirmAction =
  | { type: 'disable'; user: StaffProfile }
  | { type: 'delete'; user: StaffProfile };

/**
 * Super-admin-only page for managing invited staff profiles, module permissions,
 * account activation status, and reviewing the permission audit log.
 */
export function PermissionsPage() {
  const { profile } = useAuth();
  const currentUserEmail = (profile?.email || '').toLowerCase();

  const [activeTab, setActiveTab] = useState<ActiveTab>('users');
  const [users, setUsers] = useState<StaffProfile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [editingUser, setEditingUser] = useState<StaffProfile | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [processingAction, setProcessingAction] = useState(false);

  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ id: Date.now(), type, message });
  }, []);

  // Auto-dismiss toast after 5 seconds
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => {
      setToast(null);
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  // Subscribe to all staff profiles
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'profiles'),
      (snapshot) => {
        const list: StaffProfile[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data() as StaffProfile;
          return {
            ...data,
            email: (data.email || docSnap.id).toLowerCase(),
          };
        });
        list.sort((a, b) => (a.fullName || a.email).localeCompare(b.fullName || b.email));
        setUsers(list);
        setLoadingUsers(false);
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.LIST, 'profiles');
        } catch {
          showToast('error', 'Unable to load staff profiles. Check your permissions.');
          setLoadingUsers(false);
        }
      }
    );

    return () => unsubscribe();
  }, [showToast]);

  const handleEnableUser = async (target: StaffProfile) => {
    const targetEmail = target.email.toLowerCase();
    const profilePath = `profiles/${targetEmail}`;
    setProcessingAction(true);

    try {
      try {
        await updateDoc(doc(db, 'profiles', targetEmail), {
          isActive: true,
          updatedAt: serverTimestamp(),
          updatedBy: currentUserEmail,
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, profilePath);
      }

      await logPermissionActivity({
        userEmail: currentUserEmail,
        action: 'enabled_user',
        targetEmail,
        details: `Re-enabled access for ${target.fullName} (${targetEmail})`,
      });

      showToast('success', `${target.fullName} has been enabled.`);
    } catch (err) {
      console.error('Failed to enable user:', err);
      showToast('error', 'Could not enable user due to a Firestore permission error.');
    } finally {
      setProcessingAction(false);
    }
  };

  const handleToggleActiveClick = (target: StaffProfile) => {
    if (target.isActive) {
      setConfirmAction({ type: 'disable', user: target });
    } else {
      handleEnableUser(target);
    }
  };

  const handleConfirmAction = async () => {
    if (!confirmAction) return;
    const target = confirmAction.user;
    const targetEmail = target.email.toLowerCase();
    const profilePath = `profiles/${targetEmail}`;

    setProcessingAction(true);

    try {
      if (confirmAction.type === 'disable') {
        try {
          await updateDoc(doc(db, 'profiles', targetEmail), {
            isActive: false,
            updatedAt: serverTimestamp(),
            updatedBy: currentUserEmail,
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, profilePath);
        }

        await logPermissionActivity({
          userEmail: currentUserEmail,
          action: 'disabled_user',
          targetEmail,
          details: `Disabled access for ${target.fullName} (${targetEmail})`,
        });

        showToast('success', `${target.fullName} has been disabled.`);
      } else if (confirmAction.type === 'delete') {
        try {
          await deleteDoc(doc(db, 'profiles', targetEmail));
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, profilePath);
        }

        await logPermissionActivity({
          userEmail: currentUserEmail,
          action: 'deleted_user',
          targetEmail,
          details: `Removed profile for ${target.fullName} (${targetEmail})`,
        });

        showToast('success', `${target.fullName} has been removed.`);
      }

      setConfirmAction(null);
    } catch (err) {
      console.error('Action failed:', err);
      showToast('error', 'Action could not be completed due to a Firestore error.');
    } finally {
      setProcessingAction(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-[#0F2942] tracking-tight">
            Permissions &amp; Staff Access
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Invite authorized Gmail accounts, control module access, and review audit events.
          </p>
        </div>

        <div className="inline-flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('users')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'users'
                ? 'bg-white text-[#0F2942] shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Users ({users.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('activity')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === 'activity'
                ? 'bg-white text-[#0F2942] shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Activity Log
          </button>
        </div>
      </div>

      {/* Main Content */}
      {activeTab === 'users' ? (
        <UserTable
          users={users}
          loading={loadingUsers}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          currentUserEmail={currentUserEmail}
          onInviteClick={() => setShowInviteModal(true)}
          onEditClick={(u) => setEditingUser(u)}
          onToggleActiveClick={handleToggleActiveClick}
          onDeleteClick={(u) => setConfirmAction({ type: 'delete', user: u })}
        />
      ) : (
        <ActivityLog />
      )}

      {/* Invite User Modal */}
      {showInviteModal && (
        <InviteModal
          currentUserEmail={currentUserEmail}
          onClose={() => setShowInviteModal(false)}
          onSuccess={(msg) => showToast('success', msg)}
          onError={(msg) => showToast('error', msg)}
        />
      )}

      {/* Edit Permissions Modal */}
      {editingUser && (
        <EditPermissionsModal
          targetUser={editingUser}
          currentUserEmail={currentUserEmail}
          onClose={() => setEditingUser(null)}
          onSuccess={(msg) => showToast('success', msg)}
          onError={(msg) => showToast('error', msg)}
        />
      )}

      {/* Confirmation Dialog for Disable / Delete */}
      {confirmAction && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
        >
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl shadow-xl p-6 space-y-4">
            <h2
              id="confirm-dialog-title"
              className="font-display text-base font-semibold text-slate-900"
            >
              {confirmAction.type === 'disable'
                ? `Disable ${confirmAction.user.fullName}?`
                : `Delete ${confirmAction.user.fullName}?`}
            </h2>

            <p className="text-sm text-slate-600 leading-relaxed">
              {confirmAction.type === 'disable' ? (
                <>
                  <span className="font-mono text-xs text-slate-800">
                    {confirmAction.user.email}
                  </span>{' '}
                  will receive the Access Denied screen on their next page load until re-enabled.
                </>
              ) : (
                <>
                  This removes their access. They can be invited again later. (
                  <span className="font-mono text-xs text-slate-800">
                    {confirmAction.user.email}
                  </span>
                  )
                </>
              )}
            </p>

            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                disabled={processingAction}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAction}
                disabled={processingAction}
                className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors cursor-pointer disabled:opacity-60 ${
                  confirmAction.type === 'delete'
                    ? 'bg-red-700 hover:bg-red-800'
                    : 'bg-amber-700 hover:bg-amber-800'
                }`}
              >
                {processingAction
                  ? 'Processing...'
                  : confirmAction.type === 'disable'
                    ? 'Disable User'
                    : 'Delete User'}
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
