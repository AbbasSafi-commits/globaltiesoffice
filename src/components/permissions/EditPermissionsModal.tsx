import React, { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { StaffProfile } from '../../context/AuthContext';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { logPermissionActivity } from './activityLogger';
import { PermissionGrid } from './PermissionGrid';
import {
  createFullPermissions,
  formatRoleName,
  FullPermissionsGrid,
  getPresetPermissions,
  normalizePermissions,
  ROLE_OPTIONS,
  RolePresetKey,
} from './permissionPresets';

interface EditPermissionsModalProps {
  targetUser: StaffProfile;
  currentUserEmail: string;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

function toPresetKey(role?: string): RolePresetKey {
  if (
    role === 'manager' ||
    role === 'accountant' ||
    role === 'data_entry' ||
    role === 'custom' ||
    role === 'super_admin'
  ) {
    return role;
  }
  return 'custom';
}

/**
 * Modal for editing an existing staff member's role and module permissions.
 */
export function EditPermissionsModal({
  targetUser,
  currentUserEmail,
  onClose,
  onSuccess,
  onError,
}: EditPermissionsModalProps) {
  const initialRole = toPresetKey(targetUser.role);
  const [role, setRole] = useState<RolePresetKey>(initialRole);
  const [permissions, setPermissions] = useState<FullPermissionsGrid>(() =>
    initialRole === 'super_admin'
      ? createFullPermissions()
      : normalizePermissions(targetUser.permissions)
  );
  const [confirmingSuperAdmin, setConfirmingSuperAdmin] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleRoleChange = (nextRole: RolePresetKey) => {
    setRole(nextRole);
    setPermissions(getPresetPermissions(nextRole));
    setConfirmingSuperAdmin(false);
  };

  const handleGridChange = (nextPermissions: FullPermissionsGrid) => {
    setPermissions(nextPermissions);
    if (role !== 'custom' && role !== 'super_admin') {
      setRole('custom');
    }
  };

  const executeSave = async () => {
    setSubmitting(true);
    const targetEmail = targetUser.email.toLowerCase();
    const profilePath = `profiles/${targetEmail}`;
    const profileRef = doc(db, 'profiles', targetEmail);

    const permissionsToSave =
      role === 'super_admin' ? createFullPermissions() : permissions;

    try {
      try {
        await updateDoc(profileRef, {
          role,
          permissions: permissionsToSave,
          updatedAt: serverTimestamp(),
          updatedBy: currentUserEmail.toLowerCase(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, profilePath);
      }

      await logPermissionActivity({
        userEmail: currentUserEmail,
        action: 'updated_permissions',
        targetEmail,
        details: `Updated ${targetUser.fullName} (${targetEmail}) to ${formatRoleName(role)}`,
      });

      onSuccess(`Permissions updated for ${targetUser.fullName}.`);
      onClose();
    } catch (err) {
      console.error('Failed to update permissions:', err);
      onError('Unable to update permissions due to a Firestore error.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Ask for explicit confirmation when assigning super_admin access
    if (role === 'super_admin' && targetUser.role !== 'super_admin' && !confirmingSuperAdmin) {
      setConfirmingSuperAdmin(true);
      return;
    }

    await executeSave();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-[1px] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-permissions-title"
    >
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
        <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/70">
          <div>
            <h2
              id="edit-permissions-title"
              className="text-base font-semibold text-slate-900"
            >
              Edit Permissions
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {targetUser.fullName}{' '}
              <span className="text-slate-400" aria-hidden="true">
                ·
              </span>{' '}
              <span className="font-mono">{targetUser.email}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 cursor-pointer"
            aria-label="Close edit permissions modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="overflow-y-auto flex-1 p-6 space-y-5">
            <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-4 space-y-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Role &amp; Permissions
              </div>

              <div>
                <label
                  htmlFor="edit-role"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  Role Preset
                </label>
                <select
                  id="edit-role"
                  value={role}
                  onChange={(e) => handleRoleChange(e.target.value as RolePresetKey)}
                  className="w-full sm:w-64 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
                >
                  {ROLE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {role === 'super_admin' ? (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
                  <div className="text-sm text-red-900">
                    <p className="font-semibold">
                      Full access to everything including users and passwords. Use carefully.
                    </p>
                    <p className="mt-1 text-xs text-red-700">
                      The permission grid is hidden for Super Admins because they automatically have full access to all modules and user management.
                    </p>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-slate-700">
                      Module Permissions
                    </span>
                    <span className="text-xs text-slate-500">
                      Adjusting checkboxes switches role to Custom
                    </span>
                  </div>
                  <PermissionGrid
                    permissions={permissions}
                    onChange={handleGridChange}
                    disabled={submitting}
                  />
                </div>
              )}
            </div>

            {confirmingSuperAdmin && (
              <div className="rounded-xl border border-red-300 bg-red-50 p-4 space-y-1.5">
                <p className="text-sm font-semibold text-red-900">
                  Confirm Super Admin Promotion
                </p>
                <p className="text-xs text-red-800">
                  Are you sure you want to grant <span className="font-mono">{targetUser.email}</span> full Super Admin access?
                </p>
              </div>
            )}
          </div>

          <div className="sticky bottom-0 shrink-0 px-6 py-4 border-t border-slate-200 bg-white flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                if (confirmingSuperAdmin) {
                  setConfirmingSuperAdmin(false);
                } else {
                  onClose();
                }
              }}
              disabled={submitting}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              {confirmingSuperAdmin ? 'Back' : 'Cancel'}
            </button>

            <button
              type="submit"
              disabled={submitting}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors cursor-pointer disabled:opacity-60 ${
                confirmingSuperAdmin
                  ? 'border border-red-300 bg-white text-red-700 hover:bg-red-50'
                  : 'bg-[#2563EB] text-white hover:bg-[#1D4ED8]'
              }`}
            >
              {submitting
                ? 'Saving...'
                : confirmingSuperAdmin
                  ? 'Confirm & Save Super Admin'
                  : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
