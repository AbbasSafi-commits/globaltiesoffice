import React, { useState } from 'react';
import { X } from 'lucide-react';
import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import {
  CLIENT_STATUS_OPTIONS,
  CLIENT_TYPE_DROPDOWN_OPTIONS,
  ClientRecord,
  ClientStatus,
  CNIC_REGEX,
  formatCnicInput,
  logClientActivity,
  PRESET_CLIENT_TYPES,
} from './clientTypes';

interface ClientFormModalProps {
  existingClient?: ClientRecord | null;
  currentUserEmail: string;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function resolveInitialTypeState(clientType?: string): {
  dropdown: string;
  custom: string;
} {
  if (!clientType) {
    return { dropdown: 'Business Registration', custom: '' };
  }
  const isPreset = (PRESET_CLIENT_TYPES as readonly string[]).includes(clientType);
  if (isPreset) {
    return { dropdown: clientType, custom: '' };
  }
  return { dropdown: 'Other', custom: clientType };
}

/**
 * Add / Edit Client form modal covering Personal, Identity, Client Type,
 * Status, and Notes sections with validation and Firestore persistence.
 */
export function ClientFormModal({
  existingClient,
  currentUserEmail,
  onClose,
  onSuccess,
  onError,
}: ClientFormModalProps) {
  const isEditMode = Boolean(existingClient);
  const initialType = resolveInitialTypeState(existingClient?.clientType);

  // 1. Personal
  const [name, setName] = useState(existingClient?.name || '');
  const [fatherName, setFatherName] = useState(existingClient?.fatherName || '');
  const [mobile, setMobile] = useState(existingClient?.mobile || '');
  const [email, setEmail] = useState(existingClient?.email || '');
  const [address, setAddress] = useState(existingClient?.address || '');

  // 2. Identity
  const [cnic, setCnic] = useState(existingClient?.cnic || '');
  const [cnicIssueDate, setCnicIssueDate] = useState(existingClient?.cnicIssueDate || '');
  const [cnicExpiryDate, setCnicExpiryDate] = useState(existingClient?.cnicExpiryDate || '');
  const [passportNumber, setPassportNumber] = useState(existingClient?.passportNumber || '');
  const [passportIssueDate, setPassportIssueDate] = useState(
    existingClient?.passportIssueDate || ''
  );
  const [passportExpiryDate, setPassportExpiryDate] = useState(
    existingClient?.passportExpiryDate || ''
  );
  const [ntn, setNtn] = useState(existingClient?.ntn || '');

  // 3. Client Type
  const [typeDropdown, setTypeDropdown] = useState(initialType.dropdown);
  const [customType, setCustomType] = useState(initialType.custom);

  // 4. Status
  const [status, setStatus] = useState<ClientStatus>(existingClient?.status || 'Active');

  // 5. Notes
  const [notes, setNotes] = useState(existingClient?.notes || '');

  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanName = name.trim();
    const cleanFatherName = fatherName.trim();
    const cleanMobile = mobile.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanAddress = address.trim();
    const cleanCnic = cnic.trim();
    const cleanPassportNumber = passportNumber.trim().toUpperCase();
    const cleanNtn = ntn.trim();
    const cleanNotes = notes.trim();
    const resolvedClientType =
      typeDropdown === 'Other' ? customType.trim() : typeDropdown;

    // Validation checks
    if (!cleanName) {
      setValidationError('Client Name is required.');
      return;
    }
    if (cleanName.length > 120) {
      setValidationError('Client Name must be 120 characters or fewer.');
      return;
    }
    if (!cleanMobile) {
      setValidationError('Mobile No is required.');
      return;
    }
    if (cleanEmail && !EMAIL_REGEX.test(cleanEmail)) {
      setValidationError('Please enter a valid Email Address.');
      return;
    }
    if (cleanCnic && !CNIC_REGEX.test(cleanCnic)) {
      setValidationError('CNIC Number must follow the format 00000-0000000-0.');
      return;
    }
    if (cnicIssueDate && cnicExpiryDate && cnicExpiryDate <= cnicIssueDate) {
      setValidationError('CNIC Expiry Date must be after CNIC Issue Date.');
      return;
    }
    if (
      passportIssueDate &&
      passportExpiryDate &&
      passportExpiryDate <= passportIssueDate
    ) {
      setValidationError('Passport Expiry Date must be after Passport Issue Date.');
      return;
    }
    if (!resolvedClientType) {
      setValidationError('Please specify the Client Type.');
      return;
    }
    if (resolvedClientType.length > 80) {
      setValidationError('Client Type must be 80 characters or fewer.');
      return;
    }

    setValidationError(null);
    setSubmitting(true);

    const payloadBase = {
      name: cleanName,
      nameLower: cleanName.toLowerCase(),
      fatherName: cleanFatherName,
      mobile: cleanMobile,
      email: cleanEmail,
      address: cleanAddress,
      cnic: cleanCnic,
      cnicIssueDate,
      cnicExpiryDate,
      passportNumber: cleanPassportNumber,
      passportIssueDate,
      passportExpiryDate,
      ntn: cleanNtn,
      clientType: resolvedClientType,
      status,
      notes: cleanNotes,
      updatedAt: serverTimestamp(),
      updatedBy: currentUserEmail.toLowerCase(),
    };

    try {
      if (isEditMode && existingClient) {
        const clientPath = `clients/${existingClient.id}`;
        try {
          await updateDoc(doc(db, 'clients', existingClient.id), payloadBase);
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, clientPath);
        }

        await logClientActivity({
          userEmail: currentUserEmail,
          action: 'updated_client',
          targetId: existingClient.id,
          details: `Updated client "${cleanName}" (${resolvedClientType})`,
        });

        onSuccess(`Client "${cleanName}" updated successfully.`);
      } else {
        let createdId = '';
        try {
          const docRef = await addDoc(collection(db, 'clients'), {
            ...payloadBase,
            createdAt: serverTimestamp(),
            createdBy: currentUserEmail.toLowerCase(),
          });
          createdId = docRef.id;
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, 'clients');
        }

        await logClientActivity({
          userEmail: currentUserEmail,
          action: 'added_client',
          targetId: createdId,
          details: `Added client "${cleanName}" (${resolvedClientType})`,
        });

        onSuccess(`Client "${cleanName}" added successfully.`);
      }

      onClose();
    } catch (err) {
      console.error('Failed to save client:', err);
      onError('Unable to save client due to a Firestore permission or network error.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/50 p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="client-form-title"
    >
      <div className="w-full max-w-3xl bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden my-6">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/70">
          <div>
            <h2
              id="client-form-title"
              className="font-display text-base font-semibold text-[#0F2942]"
            >
              {isEditMode ? 'Edit Client' : 'Add Client'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {isEditMode
                ? 'Update personal, identity, and classification details.'
                : 'Register a new client record in Global Ties Office.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 cursor-pointer"
            aria-label="Close client form"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {validationError && (
            <div
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
              role="alert"
            >
              {validationError}
            </div>
          )}

          {/* 1. Personal */}
          <section className="space-y-4">
            <h3 className="font-display text-sm font-semibold text-slate-900 border-b border-slate-200 pb-2">
              1. Personal Details
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="client-name"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  Name <span className="text-red-600">*</span>
                </label>
                <input
                  id="client-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={120}
                  required
                  placeholder="Full legal name"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#1D4ED8] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/15"
                />
              </div>

              <div>
                <label
                  htmlFor="client-father"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  Father Name
                </label>
                <input
                  id="client-father"
                  type="text"
                  value={fatherName}
                  onChange={(e) => setFatherName(e.target.value)}
                  maxLength={120}
                  placeholder="Father's full name"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#1D4ED8] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/15"
                />
              </div>

              <div>
                <label
                  htmlFor="client-mobile"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  Mobile No <span className="text-red-600">*</span>
                </label>
                <input
                  id="client-mobile"
                  type="tel"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  maxLength={30}
                  required
                  placeholder="e.g. 0300-1234567"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono text-slate-900 placeholder:text-slate-400 focus:border-[#1D4ED8] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/15"
                />
              </div>

              <div>
                <label
                  htmlFor="client-email"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  Email Address
                </label>
                <input
                  id="client-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  maxLength={254}
                  placeholder="client@example.com"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#1D4ED8] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/15"
                />
              </div>

              <div className="sm:col-span-2">
                <label
                  htmlFor="client-address"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  Address
                </label>
                <input
                  id="client-address"
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  maxLength={500}
                  placeholder="Street, city, and postal address"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#1D4ED8] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/15"
                />
              </div>
            </div>
          </section>

          {/* 2. Identity */}
          <section className="space-y-4">
            <h3 className="font-display text-sm font-semibold text-slate-900 border-b border-slate-200 pb-2">
              2. Identity &amp; Tax Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label
                  htmlFor="client-cnic"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  CNIC Number
                </label>
                <input
                  id="client-cnic"
                  type="text"
                  value={cnic}
                  onChange={(e) => setCnic(formatCnicInput(e.target.value))}
                  maxLength={15}
                  placeholder="00000-0000000-0"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono tabular-nums text-slate-900 placeholder:text-slate-400 focus:border-[#1D4ED8] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/15"
                />
              </div>

              <div>
                <label
                  htmlFor="client-cnic-issue"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  CNIC Issue Date
                </label>
                <input
                  id="client-cnic-issue"
                  type="date"
                  value={cnicIssueDate}
                  onChange={(e) => setCnicIssueDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-[#1D4ED8] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/15"
                />
              </div>

              <div>
                <label
                  htmlFor="client-cnic-expiry"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  CNIC Expiry Date
                </label>
                <input
                  id="client-cnic-expiry"
                  type="date"
                  value={cnicExpiryDate}
                  onChange={(e) => setCnicExpiryDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-[#1D4ED8] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/15"
                />
              </div>

              <div>
                <label
                  htmlFor="client-passport"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  Passport Number
                </label>
                <input
                  id="client-passport"
                  type="text"
                  value={passportNumber}
                  onChange={(e) => setPassportNumber(e.target.value)}
                  maxLength={40}
                  placeholder="e.g. AB1234567"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono uppercase text-slate-900 placeholder:text-slate-400 focus:border-[#1D4ED8] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/15"
                />
              </div>

              <div>
                <label
                  htmlFor="client-passport-issue"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  Passport Issue Date
                </label>
                <input
                  id="client-passport-issue"
                  type="date"
                  value={passportIssueDate}
                  onChange={(e) => setPassportIssueDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-[#1D4ED8] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/15"
                />
              </div>

              <div>
                <label
                  htmlFor="client-passport-expiry"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  Passport Expiry Date
                </label>
                <input
                  id="client-passport-expiry"
                  type="date"
                  value={passportExpiryDate}
                  onChange={(e) => setPassportExpiryDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-[#1D4ED8] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/15"
                />
              </div>

              <div>
                <label
                  htmlFor="client-ntn"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  NTN
                </label>
                <input
                  id="client-ntn"
                  type="text"
                  value={ntn}
                  onChange={(e) => setNtn(e.target.value)}
                  maxLength={40}
                  placeholder="National Tax Number"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono text-slate-900 placeholder:text-slate-400 focus:border-[#1D4ED8] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/15"
                />
              </div>
            </div>
          </section>

          {/* 3. Client Type & 4. Status */}
          <section className="space-y-4">
            <h3 className="font-display text-sm font-semibold text-slate-900 border-b border-slate-200 pb-2">
              3. Classification &amp; Status
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="client-type"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  Client Type <span className="text-red-600">*</span>
                </label>
                <select
                  id="client-type"
                  value={typeDropdown}
                  onChange={(e) => setTypeDropdown(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#1D4ED8] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/15"
                >
                  {CLIENT_TYPE_DROPDOWN_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="client-status"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  Status <span className="text-red-600">*</span>
                </label>
                <select
                  id="client-status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as ClientStatus)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#1D4ED8] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/15"
                >
                  {CLIENT_STATUS_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              {typeDropdown === 'Other' && (
                <div className="sm:col-span-2">
                  <label
                    htmlFor="client-custom-type"
                    className="block text-xs font-medium text-slate-700 mb-1.5"
                  >
                    Custom Client Type <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="client-custom-type"
                    type="text"
                    value={customType}
                    onChange={(e) => setCustomType(e.target.value)}
                    maxLength={80}
                    required
                    placeholder="Enter custom client type (e.g. Tax Filing, Trademark)"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#1D4ED8] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/15"
                  />
                </div>
              )}
            </div>
          </section>

          {/* 5. Notes */}
          <section className="space-y-2">
            <label
              htmlFor="client-notes"
              className="block font-display text-sm font-semibold text-slate-900"
            >
              4. Notes
            </label>
            <textarea
              id="client-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={2000}
              placeholder="Optional internal office notes (do not store passwords here)"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#1D4ED8] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/15"
            />
          </section>

          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-[#0F2942] px-5 py-2 text-sm font-medium text-white hover:bg-[#163859] disabled:opacity-60 transition-colors cursor-pointer"
            >
              {submitting
                ? 'Saving...'
                : isEditMode
                  ? 'Save Changes'
                  : 'Save Client'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
