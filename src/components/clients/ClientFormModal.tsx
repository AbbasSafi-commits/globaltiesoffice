import React, { useRef, useState } from 'react';
import { Camera, Trash2, X } from 'lucide-react';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { ClientAvatar } from './ClientAvatar';
import {
  CLIENT_STATUS_OPTIONS,
  CLIENT_TYPE_DROPDOWN_OPTIONS,
  ClientRecord,
  ClientStatus,
  CNIC_REGEX,
  formatCnicInput,
  logClientActivity,
  PRESET_CLIENT_TYPES,
  processClientPhoto,
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
  if (!clientType || !clientType.trim()) {
    return { dropdown: '', custom: '' };
  }
  const isPreset = (PRESET_CLIENT_TYPES as readonly string[]).includes(clientType);
  if (isPreset) {
    return { dropdown: clientType, custom: '' };
  }
  return { dropdown: 'Other', custom: clientType };
}

/**
 * Add / Edit Client modal. Only "Name" is required; all other fields are optional
 * and validated only when a value is entered. Supports 256x256 square-cropped
 * JPEG profile photos stored as `photoData` and syncs INC No & NTN to existing
 * `businessDetails/{clientId}` documents.
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
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  // 1. Personal & Profile Photo
  const [name, setName] = useState(existingClient?.name || '');
  const [fatherName, setFatherName] = useState(existingClient?.fatherName || '');
  const [mobile, setMobile] = useState(existingClient?.mobile || '');
  const [email, setEmail] = useState(existingClient?.email || '');
  const [address, setAddress] = useState(existingClient?.address || '');
  const [photoData, setPhotoData] = useState(existingClient?.photoData || '');
  const [photoProcessing, setPhotoProcessing] = useState(false);

  // 2. Identity, Tax & Dates
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
  const [incNo, setIncNo] = useState(existingClient?.incNo || '');
  const [taxYear, setTaxYear] = useState(existingClient?.taxYear || '');
  const [incDate, setIncDate] = useState(existingClient?.incDate || '');
  const [registrationDate, setRegistrationDate] = useState(
    existingClient?.registrationDate || ''
  );
  const [taxFilingDate, setTaxFilingDate] = useState(existingClient?.taxFilingDate || '');

  // 3. Client Type & Status
  const [typeDropdown, setTypeDropdown] = useState(initialType.dropdown);
  const [customType, setCustomType] = useState(initialType.custom);
  const [status, setStatus] = useState<ClientStatus>(existingClient?.status || 'Active');

  // 4. Notes
  const [notes, setNotes] = useState(existingClient?.notes || '');

  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setValidationError(null);
    setPhotoProcessing(true);
    try {
      const processed = await processClientPhoto(file);
      setPhotoData(processed);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Unable to process the selected photo.';
      setValidationError(msg);
    } finally {
      setPhotoProcessing(false);
    }
  };

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
    const cleanIncNo = incNo.trim();
    const cleanTaxYear = taxYear.trim();
    const cleanNotes = notes.trim();
    const resolvedClientType =
      typeDropdown === 'Other' ? customType.trim() : typeDropdown;

    // Only Name is required; validate formats only when a value is entered
    if (!cleanName) {
      setValidationError('Client Name is required.');
      return;
    }
    if (cleanName.length > 120) {
      setValidationError('Client Name must be 120 characters or fewer.');
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
    if (resolvedClientType && resolvedClientType.length > 80) {
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
      incNo: cleanIncNo,
      taxYear: cleanTaxYear,
      incDate,
      registrationDate,
      taxFilingDate,
      photoData,
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

        // Sync INC No and NTN into existing businessDetails/{clientId} if present
        try {
          const businessRef = doc(db, 'businessDetails', existingClient.id);
          const businessSnap = await getDoc(businessRef);
          if (businessSnap.exists()) {
            await updateDoc(businessRef, {
              incNo: cleanIncNo,
              ntn: cleanNtn,
              updatedAt: serverTimestamp(),
              updatedBy: currentUserEmail.toLowerCase(),
            });
          }
        } catch {
          // Non-blocking if user lacks business_details permission
        }

        await logClientActivity({
          userEmail: currentUserEmail,
          action: 'updated_client',
          targetId: existingClient.id,
          details: resolvedClientType
            ? `Updated client "${cleanName}" (${resolvedClientType})`
            : `Updated client "${cleanName}"`,
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
          details: resolvedClientType
            ? `Added client "${cleanName}" (${resolvedClientType})`
            : `Added client "${cleanName}"`,
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-[1px] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="client-form-title"
    >
      <div className="w-full max-w-3xl max-h-[90vh] flex flex-col bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white shrink-0">
          <div>
            <h2
              id="client-form-title"
              className="text-base font-semibold text-slate-900"
            >
              {isEditMode ? 'Edit Client' : 'Add Client'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {isEditMode
                ? 'Update personal, identity, tax, and classification details.'
                : 'Register a new client record in Global Ties. Only Name is required.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
            aria-label="Close client form"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="p-6 space-y-5 overflow-y-auto flex-1 bg-page/60">
            {validationError && (
              <div
                className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
                role="alert"
              >
                {validationError}
              </div>
            )}

            {/* 1. Personal & Photo */}
            <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-4 shadow-2xs">
              <h3 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-2.5">
                1. Personal Details
              </h3>

              {/* Optional Profile Photo */}
              <div className="flex flex-wrap items-center gap-4 pb-2">
                <ClientAvatar
                  name={name || 'Client'}
                  photoData={photoData}
                  size="lg"
                />
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      ref={photoInputRef}
                      type="file"
                      accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                      onChange={handlePhotoSelect}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => photoInputRef.current?.click()}
                      disabled={submitting || photoProcessing}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-primary hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <Camera className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>
                        {photoProcessing
                          ? 'Processing...'
                          : photoData
                            ? 'Change Photo'
                            : 'Upload Photo'}
                      </span>
                    </button>

                    {photoData && (
                      <button
                        type="button"
                        onClick={() => setPhotoData('')}
                        disabled={submitting || photoProcessing}
                        className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Remove photo</span>
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Optional JPG or PNG · Auto-cropped to 256×256 square
                  </p>
                </div>
              </div>

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
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
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
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div>
                  <label
                    htmlFor="client-mobile"
                    className="block text-xs font-medium text-slate-700 mb-1.5"
                  >
                    Mobile No
                  </label>
                  <input
                    id="client-mobile"
                    type="tel"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    maxLength={30}
                    placeholder="e.g. 0300-1234567"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-mono text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
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
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
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
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>
            </section>

            {/* 2. Identity, Tax & Dates */}
            <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-4 shadow-2xs">
              <h3 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-2.5">
                2. Identity, Tax &amp; Important Dates
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
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-mono tabular-nums text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
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
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
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
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
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
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-mono uppercase text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
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
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
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
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
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
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-mono text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div>
                  <label
                    htmlFor="client-inc-no"
                    className="block text-xs font-medium text-slate-700 mb-1.5"
                  >
                    INC No
                  </label>
                  <input
                    id="client-inc-no"
                    type="text"
                    value={incNo}
                    onChange={(e) => setIncNo(e.target.value)}
                    maxLength={60}
                    placeholder="Incorporation No"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-mono text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div>
                  <label
                    htmlFor="client-tax-year"
                    className="block text-xs font-medium text-slate-700 mb-1.5"
                  >
                    Tax Year
                  </label>
                  <input
                    id="client-tax-year"
                    type="text"
                    value={taxYear}
                    onChange={(e) => setTaxYear(e.target.value)}
                    maxLength={30}
                    placeholder="e.g. 2025-26"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-mono text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div>
                  <label
                    htmlFor="client-inc-date"
                    className="block text-xs font-medium text-slate-700 mb-1.5"
                  >
                    INC Date
                  </label>
                  <input
                    id="client-inc-date"
                    type="date"
                    value={incDate}
                    onChange={(e) => setIncDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div>
                  <label
                    htmlFor="client-registration-date"
                    className="block text-xs font-medium text-slate-700 mb-1.5"
                  >
                    Registration Date
                  </label>
                  <input
                    id="client-registration-date"
                    type="date"
                    value={registrationDate}
                    onChange={(e) => setRegistrationDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div>
                  <label
                    htmlFor="client-tax-filing-date"
                    className="block text-xs font-medium text-slate-700 mb-1.5"
                  >
                    Tax Filing Date
                  </label>
                  <input
                    id="client-tax-filing-date"
                    type="date"
                    value={taxFilingDate}
                    onChange={(e) => setTaxFilingDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>
            </section>

            {/* 3. Classification & Status */}
            <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-4 shadow-2xs">
              <h3 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-2.5">
                3. Classification &amp; Status
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="client-type"
                    className="block text-xs font-medium text-slate-700 mb-1.5"
                  >
                    Client Type
                  </label>
                  <select
                    id="client-type"
                    value={typeDropdown}
                    onChange={(e) => setTypeDropdown(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="">— Select Client Type (Optional) —</option>
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
                    Status
                  </label>
                  <select
                    id="client-status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as ClientStatus)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
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
                      Custom Client Type
                    </label>
                    <input
                      id="client-custom-type"
                      type="text"
                      value={customType}
                      onChange={(e) => setCustomType(e.target.value)}
                      maxLength={80}
                      placeholder="Enter custom client type (e.g. Tax Filing, Trademark)"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                )}
              </div>
            </section>

            {/* 4. Notes */}
            <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-2 shadow-2xs">
              <label
                htmlFor="client-notes"
                className="block text-sm font-semibold text-slate-900"
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
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </section>
          </div>

          <div className="sticky bottom-0 shrink-0 px-6 py-4 border-t border-slate-200 bg-white flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || photoProcessing}
              className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-60 transition-colors shadow-xs cursor-pointer"
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
