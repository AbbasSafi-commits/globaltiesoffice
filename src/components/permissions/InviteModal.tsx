import React, { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { logPermissionActivity } from './activityLogger';
import { PermissionGrid } from './PermissionGrid';
import {
  createFullPermissions,
  formatRoleName,
  FullPermissionsGrid,
  getPresetPermissions,
  ROLE_OPTIONS,
  RolePresetKey,
} from './permissionPresets';

interface InviteModalProps {
  currentUserEmail: string;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

const GMAIL_REGEX = /^[a-z0-9._%+-]+@gmail\.com$/;

/**
 * Modal for inviting a new Gmail user, assigning a role preset or custom permissions,
 * and preventing overwrites of existing profiles.
 */
export function InviteModal({
  currentUserEmail,
  onClose,
  onSuccess,
  onError,
}: InviteModalProps) {
  const [fullName, setFullName] = useState('');
  const [gmail, setGmail] = useState('');
  const [role, setRole] = useState<RolePresetKey>('manager');
  const [permissions, setPermissions] = useState<FullPermissionsGrid>(() =>
    getPresetPermissions('manager')
  );
  const [validationError, setValidationError] = useState<string | null>(null);
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

  const validateInputs = (): { cleanName: string; cleanEmail: string } | null => {
    const cleanName = fullName.trim();
    const cleanEmail = gmail.trim().toLowerCase();

    if (!cleanName) {
      setValidationError('Full name is required.');
      return null;
    }
    if (cleanName.length > 120) {
      setValidationError('Full name must be 120 characters or fewer.');
      return null;
    }
    if (!cleanEmail) {
      setValidationError('Gmail address is required.');
      return null;
    }
    if (!GMAIL_REGEX.test(cleanEmail)) {
      setValidationError('Please enter a valid @gmail.com address.');
      return null;
    }

    setValidationError(null);
    return { cleanName, cleanEmail };
  };

  const executeInvite = async (cleanName: string, cleanEmail: string) => {
    setSubmitting(true);
    const profilePath = `profiles/${cleanEmail}`;
    const profileRef = doc(db, 'profiles', cleanEmail);

    try {
      // Check first so an existing profile is never overwritten
      let existingSnap;
      try {
        existingSnap = await getDoc(profileRef);
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, profilePath);
      }

      if (existingSnap.exists()) {
        setValidationError('A user with this Gmail address has already been invited.');
        setConfirmingSuperAdmin(false);
        setSubmitting(false);
        return;
      }

      const permissionsToSave =
        role === 'super_admin' ? createFullPermissions() : permissions;

      try {
        await setDoc(profileRef, {
          email: cleanEmail,
          fullName: cleanName,
          role,
          isActive: true,
          permissions: permissionsToSave,
          createdAt: serverTimestamp(),
          createdBy: currentUserEmail.toLowerCase(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, profilePath);
      }

      await logPermissionActivity({
        userEmail: currentUserEmail,
        action: 'invited_user',
        targetEmail: cleanEmail,
        details: `Invited ${cleanName} (${cleanEmail}) as ${formatRoleName(role)}`,
      });

      onSuccess('Invited. Ask them to open the website and sign in with this Gmail.');
      onClose();
    } catch (err) {
      console.error('Failed to invite user:', err);
      onError('Unable to invite user due to a Firestore error. Please verify your access.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validated = validateInputs();
    if (!validated) return;

    if (role === 'super_admin' && !confirmingSuperAdmin) {
      setConfirmingSuperAdmin(true);
      return;
    }

    await executeInvite(validated.cleanName, validated.cleanEmail);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-[1px] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="invite-modal-title"
    >
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
        <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/70">
          <div>
            <h2 id="invite-modal-title" className="text-base font-semibold text-slate-900">
              Invite User
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Grant a staff member Google sign-in access and configure module permissions.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 cursor-pointer"
            aria-label="Close invite modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="overflow-y-auto flex-1 p-6 space-y-5">
            {validationError && (
              <div
                className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
                role="alert"
              >
                {validationError}
              </div>
            )}

            {/* Staff Identity Card */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-4 space-y-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Staff Details
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="invite-fullname"
                    className="block text-xs font-medium text-slate-700 mb-1.5"
                  >
                    Full Name
                  </label>
                  <input
                    id="invite-fullname"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Sarah Jenkins"
                    maxLength={120}
                    required
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
                  />
                </div>

                <div>
                  <label
                    htmlFor="invite-gmail"
                    className="block text-xs font-medium text-slate-700 mb-1.5"
                  >
                    Gmail Address
                  </label>
                  <input
                    id="invite-gmail"
                    type="email"
                    value={gmail}
                    onChange={(e) => setGmail(e.target.value)}
                    placeholder="staffname@gmail.com"
                    required
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-mono text-slate-900 placeholder:text-slate-400 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
                  />
                </div>
              </div>
            </div>

            {/* Role & Permissions Card */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-4 space-y-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Role &amp; Permissions
              </div>

              <div>
                <label
                  htmlFor="invite-role"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  Role Preset
                </label>
                <select
                  id="invite-role"
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
                  Confirm Super Admin Invitation
                </p>
                <p className="text-xs text-red-800">
                  Are you sure you want to grant <span className="font-mono">{gmail.trim().toLowerCase()}</span> full Super Admin access? They will be able to view all portal logins and manage other staff permissions.
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
                  ? 'Confirm & Invite Super Admin'
                  : 'Invite User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
