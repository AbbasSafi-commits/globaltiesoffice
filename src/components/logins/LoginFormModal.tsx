import React, { useState } from 'react';
import { Eye, EyeOff, X } from 'lucide-react';
import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import {
  logPortalLoginActivity,
  normalizeSafeUrl,
  PortalLoginRecord,
  SUGGESTED_PORTAL_NAMES,
} from './loginTypes';

interface LoginFormModalProps {
  clientId: string;
  clientName: string;
  existingLogin?: PortalLoginRecord | null;
  currentUserEmail: string;
  onClose: () => void;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}

/**
 * Modal for adding or editing a client's portal login entry with suggested
 * government/embassy portal autocomplete and safe URL normalization.
 */
export function LoginFormModal({
  clientId,
  clientName,
  existingLogin,
  currentUserEmail,
  onClose,
  onSuccess,
  onError,
}: LoginFormModalProps) {
  const isEditMode = Boolean(existingLogin);

  const [departmentName, setDepartmentName] = useState(
    existingLogin?.departmentName || ''
  );
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [websiteUrl, setWebsiteUrl] = useState(existingLogin?.websiteUrl || '');
  const [loginId, setLoginId] = useState(existingLogin?.loginId || '');
  const [password, setPassword] = useState(existingLogin?.password || '');
  const [pinCode, setPinCode] = useState(existingLogin?.pinCode || '');
  const [notes, setNotes] = useState(existingLogin?.notes || '');

  const [showFormPassword, setShowFormPassword] = useState(false);
  const [showFormPin, setShowFormPin] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const filteredSuggestions = SUGGESTED_PORTAL_NAMES.filter((item) =>
    item.toLowerCase().includes(departmentName.trim().toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanDepartment = departmentName.trim();
    const rawUrl = websiteUrl.trim();
    const cleanLoginId = loginId.trim();
    const cleanNotes = notes.trim();

    if (!cleanDepartment) {
      setValidationError('Department / Website Name is required.');
      return;
    }

    let safeUrl = '';
    if (rawUrl) {
      safeUrl = normalizeSafeUrl(rawUrl);
      if (!safeUrl) {
        setValidationError('Please enter a valid http:// or https:// website link.');
        return;
      }
    }

    setValidationError(null);
    setSaving(true);

    const payloadBase = {
      clientId,
      departmentName: cleanDepartment,
      websiteUrl: safeUrl,
      loginId: cleanLoginId,
      password,
      pinCode,
      notes: cleanNotes,
      updatedAt: serverTimestamp(),
      updatedBy: currentUserEmail.toLowerCase(),
    };

    try {
      if (isEditMode && existingLogin) {
        const docPath = `portalLogins/${existingLogin.id}`;
        try {
          await updateDoc(doc(db, 'portalLogins', existingLogin.id), payloadBase);
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, docPath);
        }

        await logPortalLoginActivity({
          userEmail: currentUserEmail,
          action: 'updated_portal_login',
          clientId,
          websiteName: cleanDepartment,
          targetId: existingLogin.id,
          details: `Updated portal login "${cleanDepartment}" for client "${clientName}"`,
        });

        onSuccess(`Portal login "${cleanDepartment}" updated.`);
      } else {
        let createdId = '';
        try {
          const docRef = await addDoc(collection(db, 'portalLogins'), {
            ...payloadBase,
            createdAt: serverTimestamp(),
            createdBy: currentUserEmail.toLowerCase(),
          });
          createdId = docRef.id;
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, 'portalLogins');
        }

        await logPortalLoginActivity({
          userEmail: currentUserEmail,
          action: 'added_portal_login',
          clientId,
          websiteName: cleanDepartment,
          targetId: createdId,
          details: `Added portal login "${cleanDepartment}" for client "${clientName}"`,
        });

        onSuccess(`Portal login "${cleanDepartment}" saved.`);
      }

      onClose();
    } catch (err) {
      console.error('Failed to save portal login:', err instanceof Error ? err.message : 'Error');
      onError('Unable to save portal login due to a Firestore permission error.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-[1px] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="portal-login-modal-title"
    >
      <div className="w-full max-w-xl max-h-[90vh] flex flex-col bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
        <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/70">
          <div>
            <h2
              id="portal-login-modal-title"
              className="text-base font-semibold text-slate-900"
            >
              {isEditMode ? 'Edit Portal Login' : 'Add Portal Login'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Client: {clientName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 cursor-pointer"
            aria-label="Close portal login modal"
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

            {/* Portal Information Section */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-4 space-y-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Portal Information
              </div>

              {/* Department / Website Name with autocomplete suggestions */}
              <div className="relative">
                <label
                  htmlFor="login-department"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  Department / Website Name <span className="text-red-600">*</span>
                </label>
                <input
                  id="login-department"
                  type="text"
                  value={departmentName}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => {
                    window.setTimeout(() => setShowSuggestions(false), 150);
                  }}
                  onChange={(e) => {
                    setDepartmentName(e.target.value);
                    setShowSuggestions(true);
                  }}
                  maxLength={120}
                  required
                  autoComplete="off"
                  placeholder="e.g. FBR, SECP, Excise, Land Records, Embassy portal"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                {showSuggestions && filteredSuggestions.length > 0 && (
                  <ul
                    role="listbox"
                    aria-label="Suggested portal names"
                    className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto py-1"
                  >
                    {filteredSuggestions.map((suggestion) => (
                      <li key={suggestion}>
                        <button
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setDepartmentName(suggestion);
                            setShowSuggestions(false);
                          }}
                          className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-blue-50 hover:text-primary cursor-pointer"
                        >
                          {suggestion}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <label
                  htmlFor="login-url"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  Website Link (URL)
                </label>
                <input
                  id="login-url"
                  type="text"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  maxLength={500}
                  placeholder="https://iris.fbr.gov.pk"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-mono text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            {/* Credentials & Notes Section */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-4 space-y-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Credentials &amp; Notes
              </div>

              <div>
                <label
                  htmlFor="login-username"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  Login ID / Username
                </label>
                <input
                  id="login-username"
                  type="text"
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  maxLength={160}
                  autoComplete="off"
                  placeholder="Username, CNIC, or portal ID"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-mono text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="login-password"
                    className="block text-xs font-medium text-slate-700 mb-1.5"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="login-password"
                      type={showFormPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      maxLength={200}
                      autoComplete="new-password"
                      placeholder="Enter password"
                      className="w-full rounded-lg border border-slate-200 bg-white pl-3 pr-10 py-2 text-sm font-mono text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowFormPassword((prev) => !prev)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                      aria-label={showFormPassword ? 'Hide password' : 'Show password'}
                    >
                      {showFormPassword ? (
                        <EyeOff className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <Eye className="h-4 w-4" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="login-pin"
                    className="block text-xs font-medium text-slate-700 mb-1.5"
                  >
                    PIN Code
                  </label>
                  <div className="relative">
                    <input
                      id="login-pin"
                      type={showFormPin ? 'text' : 'password'}
                      value={pinCode}
                      onChange={(e) => setPinCode(e.target.value)}
                      maxLength={60}
                      autoComplete="off"
                      placeholder="Enter PIN code"
                      className="w-full rounded-lg border border-slate-200 bg-white pl-3 pr-10 py-2 text-sm font-mono text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowFormPin((prev) => !prev)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                      aria-label={showFormPin ? 'Hide PIN code' : 'Show PIN code'}
                    >
                      {showFormPin ? (
                        <EyeOff className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <Eye className="h-4 w-4" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label
                  htmlFor="login-notes"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  Notes
                </label>
                <textarea
                  id="login-notes"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  maxLength={2000}
                  placeholder="Optional security questions, recovery email, or portal instructions..."
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
          </div>

          <div className="sticky bottom-0 shrink-0 px-6 py-4 border-t border-slate-200 bg-white flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-60 transition-colors cursor-pointer"
            >
              {saving
                ? 'Saving...'
                : isEditMode
                  ? 'Save Changes'
                  : 'Save Login'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
