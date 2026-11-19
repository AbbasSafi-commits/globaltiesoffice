import React, { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import {
  addDoc,
  collection,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { DocumentUploadModal } from '../documents/DocumentUploadModal';
import {
  CASE_STATUS_OPTIONS,
  CaseStatus,
  ClientRecord,
  DEFAULT_SERVICE_DEPARTMENTS,
  logClientActivity,
  ServiceDepartmentRecord,
} from './clientTypes';
import { CompletenessModuleKey } from './clientCompleteness';

export interface QuickAddTarget {
  client: ClientRecord;
  module: Exclude<CompletenessModuleKey, 'details'>;
  mode: 'add' | 'add_another';
}

interface ClientQuickAddModalProps {
  target: QuickAddTarget;
  currentUserEmail: string;
  onClose: () => void;
  onSaved: (
    clientId: string,
    module: Exclude<CompletenessModuleKey, 'details'>,
    message: string
  ) => void;
  onError: (message: string) => void;
}

function getTodayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Quick-add modal opened directly from completeness chips in the Clients list
 * without leaving the search page or resetting scroll/search state.
 */
export function ClientQuickAddModal({
  target,
  currentUserEmail,
  onClose,
  onSaved,
  onError,
}: ClientQuickAddModalProps) {
  const { client, module, mode } = target;

  // Reuse the full DocumentUploadModal for Documents quick-add
  if (module === 'documents') {
    return (
      <DocumentUploadModal
        clientId={client.id}
        clientName={client.name}
        currentUserEmail={currentUserEmail}
        onClose={onClose}
        onSuccess={(msg) => onSaved(client.id, 'documents', msg)}
        onError={onError}
      />
    );
  }

  return (
    <QuickAddFormBody
      client={client}
      module={module}
      mode={mode}
      currentUserEmail={currentUserEmail}
      onClose={onClose}
      onSaved={onSaved}
      onError={onError}
    />
  );
}

function QuickAddFormBody({
  client,
  module,
  mode,
  currentUserEmail,
  onClose,
  onSaved,
  onError,
}: {
  client: ClientRecord;
  module: 'business' | 'logins' | 'services' | 'ledger';
  mode: 'add' | 'add_another';
  currentUserEmail: string;
  onClose: () => void;
  onSaved: (
    clientId: string,
    module: Exclude<CompletenessModuleKey, 'details'>,
    message: string
  ) => void;
  onError: (message: string) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Business state
  const [businessName, setBusinessName] = useState('');
  const [businessCategory, setBusinessCategory] = useState('');
  const [incNo, setIncNo] = useState(client.incNo || '');

  // Logins state
  const [portalName, setPortalName] = useState('');
  const [portalUrl, setPortalUrl] = useState('');
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');

  // Services state
  const [departments, setDepartments] = useState<ServiceDepartmentRecord[]>([]);
  const [deptDropdown, setDeptDropdown] = useState('');
  const [customDept, setCustomDept] = useState('');
  const [subDropdown, setSubDropdown] = useState('');
  const [customSub, setCustomSub] = useState('');
  const [serviceStatus, setServiceStatus] = useState<CaseStatus>('Not Started');
  const [feesInput, setFeesInput] = useState('');

  // Ledger state
  const [ledgerDate, setLedgerDate] = useState(getTodayIso());
  const [ledgerDesc, setLedgerDesc] = useState('');
  const [ledgerType, setLedgerType] = useState<'debit' | 'credit'>('debit');
  const [ledgerAmount, setLedgerAmount] = useState('');

  // Load managed serviceDepartments when opening Services quick-add
  useEffect(() => {
    if (module !== 'services') return;
    getDocs(collection(db, 'serviceDepartments'))
      .then((snap) => {
        const list: ServiceDepartmentRecord[] = snap.docs.map((d) => {
          const data = d.data() as Partial<ServiceDepartmentRecord>;
          return {
            id: d.id,
            name: data.name || '',
            subCategories: Array.isArray(data.subCategories) ? data.subCategories : [],
            sortOrder: typeof data.sortOrder === 'number' ? data.sortOrder : 0,
          };
        });
        list.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
        setDepartments(list);
      })
      .catch(() => {
        // Fallback to defaults if unreadable
      });
  }, [module]);

  const departmentOptions = useMemo(() => {
    const names =
      departments.length > 0
        ? departments.map((d) => d.name).filter((n) => n && n !== 'Other')
        : DEFAULT_SERVICE_DEPARTMENTS.filter((n) => n !== 'Other');
    return [...names, 'Other'];
  }, [departments]);

  const subCategoryOptions = useMemo(() => {
    if (!deptDropdown || deptDropdown === 'Other') return ['Other'];
    const matched = departments.find((d) => d.name === deptDropdown);
    const subs = (matched?.subCategories || []).filter((s) => s && s !== 'Other');
    return [...subs, 'Other'];
  }, [departments, deptDropdown]);

  const titlePrefix = mode === 'add_another' ? 'Add Another' : 'Quick Add';
  const moduleLabelMap: Record<typeof module, string> = {
    business: 'Business Details',
    logins: 'Portal Login',
    services: 'Service',
    ledger: 'Ledger Entry',
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    try {
      if (module === 'business') {
        const cleanName = businessName.trim();
        if (!cleanName) {
          setValidationError('Business Name is required.');
          return;
        }
        setSaving(true);
        const docRef = doc(db, 'businessDetails', client.id);
        await setDoc(
          docRef,
          {
            clientId: client.id,
            businessName: cleanName,
            businessCategory: businessCategory.trim(),
            incNo: incNo.trim(),
            notes: '',
            updatedAt: serverTimestamp(),
            updatedBy: currentUserEmail,
            createdAt: serverTimestamp(),
            createdBy: currentUserEmail,
          },
          { merge: true }
        );
        await logClientActivity({
          userEmail: currentUserEmail,
          action: mode === 'add_another' ? 'updated_business_details' : 'added_business_details',
          module: 'business_details',
          targetId: client.id,
          details: `Saved business details "${cleanName}" for client "${client.name}"`,
        });
        onSaved(client.id, 'business', `Business details saved for ${client.name}.`);
        onClose();
        return;
      }

      if (module === 'logins') {
        const cleanPortal = portalName.trim();
        const cleanLoginId = loginId.trim();
        if (!cleanPortal) {
          setValidationError('Department / Website Name is required.');
          return;
        }
        if (!cleanLoginId) {
          setValidationError('Login ID is required.');
          return;
        }
        setSaving(true);
        const createdRef = await addDoc(collection(db, 'portalLogins'), {
          clientId: client.id,
          departmentName: cleanPortal,
          websiteUrl: portalUrl.trim(),
          loginId: cleanLoginId,
          password: password.trim(),
          pinCode: pin.trim(),
          notes: '',
          createdAt: serverTimestamp(),
          createdBy: currentUserEmail,
          updatedAt: serverTimestamp(),
          updatedBy: currentUserEmail,
        });
        await addDoc(collection(db, 'activityLog'), {
          userEmail: currentUserEmail,
          action: 'added_portal_login',
          module: 'portal_logins',
          clientId: client.id,
          targetId: createdRef.id,
          details: `Added portal login "${cleanPortal}" for client "${client.name}"`,
          createdAt: serverTimestamp(),
        });
        onSaved(client.id, 'logins', `Login "${cleanPortal}" added for ${client.name}.`);
        onClose();
        return;
      }

      if (module === 'services') {
        const resolvedDept =
          deptDropdown === 'Other' ? customDept.trim() : deptDropdown.trim();
        const resolvedSub =
          subDropdown === 'Other' ? customSub.trim() : subDropdown.trim();
        if (!resolvedDept) {
          setValidationError('Login Department is required.');
          return;
        }
        let parsedFees: number | null = null;
        if (feesInput.trim() !== '') {
          parsedFees = Number(feesInput.trim());
          if (Number.isNaN(parsedFees) || parsedFees < 0) {
            setValidationError('Fees must be a valid non-negative number.');
            return;
          }
        }
        setSaving(true);
        const displayLabel = resolvedSub
          ? `${resolvedDept} - ${resolvedSub}`
          : resolvedDept;
        const createdRef = await addDoc(collection(db, 'cases'), {
          clientId: client.id,
          department: resolvedDept,
          subCategory: resolvedSub,
          serviceName: displayLabel,
          status: serviceStatus,
          fees: parsedFees,
          startDate: '',
          expectedDate: '',
          completedDate: '',
          notes: '',
          createdAt: serverTimestamp(),
          createdBy: currentUserEmail,
          updatedAt: serverTimestamp(),
          updatedBy: currentUserEmail,
        });
        await logClientActivity({
          userEmail: currentUserEmail,
          action: 'added_case',
          module: 'clients',
          targetId: createdRef.id,
          details: `Added service "${displayLabel}" (${serviceStatus}) for client "${client.name}"`,
        });
        onSaved(client.id, 'services', `Service "${displayLabel}" added for ${client.name}.`);
        onClose();
        return;
      }

      if (module === 'ledger') {
        const cleanDesc = ledgerDesc.trim();
        const parsedAmount = Number(ledgerAmount.trim());
        if (!ledgerDate) {
          setValidationError('Date is required.');
          return;
        }
        if (!cleanDesc) {
          setValidationError('Description is required.');
          return;
        }
        if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
          setValidationError('Amount must be greater than 0.');
          return;
        }
        setSaving(true);
        const createdRef = await addDoc(collection(db, 'ledger'), {
          clientId: client.id,
          clientName: client.name,
          date: ledgerDate,
          description: cleanDesc,
          debit: ledgerType === 'debit' ? parsedAmount : 0,
          credit: ledgerType === 'credit' ? parsedAmount : 0,
          paymentMethod: '',
          referenceNo: '',
          createdAt: serverTimestamp(),
          createdBy: currentUserEmail,
          updatedAt: serverTimestamp(),
          updatedBy: currentUserEmail,
        });
        await addDoc(collection(db, 'activityLog'), {
          userEmail: currentUserEmail,
          action: 'added_ledger_entry',
          module: 'ledger',
          clientId: client.id,
          targetId: createdRef.id,
          details: `Added ${ledgerType} entry PKR ${parsedAmount.toLocaleString()} ("${cleanDesc}") for "${client.name}"`,
          createdAt: serverTimestamp(),
        });
        onSaved(client.id, 'ledger', `Ledger entry added for ${client.name}.`);
        onClose();
      }
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.CREATE, module);
      } catch {
        onError('Unable to save record due to a Firestore permission or network error.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-[1px] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-add-title"
    >
      <div className="w-full max-w-lg max-h-[90vh] flex flex-col bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
          <div>
            <h3 id="quick-add-title" className="text-base font-semibold text-slate-900">
              {titlePrefix} {moduleLabelMap[module]}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Client: {client.name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
            aria-label="Close quick add modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="p-6 space-y-4 overflow-y-auto flex-1">
            {validationError && (
              <div
                className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-800"
                role="alert"
              >
                {validationError}
              </div>
            )}

            {module === 'business' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Business Name <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    required
                    placeholder="Registered business or company name"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Category
                  </label>
                  <input
                    type="text"
                    value={businessCategory}
                    onChange={(e) => setBusinessCategory(e.target.value)}
                    placeholder="e.g. Private Limited, Sole Proprietor, AOP"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    INC No
                  </label>
                  <input
                    type="text"
                    value={incNo}
                    onChange={(e) => setIncNo(e.target.value)}
                    placeholder="Incorporation number"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-mono text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </>
            )}

            {module === 'logins' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Department / Website Name <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={portalName}
                    onChange={(e) => setPortalName(e.target.value)}
                    required
                    placeholder="e.g. FBR IRIS, SECP eServices"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Link (URL)
                  </label>
                  <input
                    type="url"
                    value={portalUrl}
                    onChange={(e) => setPortalUrl(e.target.value)}
                    placeholder="https://iris.fbr.gov.pk"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Login ID <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={loginId}
                    onChange={(e) => setLoginId(e.target.value)}
                    required
                    placeholder="Username, CNIC, or portal ID"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-mono text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      Password
                    </label>
                    <input
                      type="text"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Portal password"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-mono text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      PIN
                    </label>
                    <input
                      type="text"
                      value={pin}
                      onChange={(e) => setPin(e.target.value)}
                      placeholder="Optional PIN"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-mono text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </div>
              </>
            )}

            {module === 'services' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Login Department <span className="text-red-600">*</span>
                  </label>
                  <select
                    value={deptDropdown}
                    onChange={(e) => {
                      setDeptDropdown(e.target.value);
                      setSubDropdown('');
                      setCustomSub('');
                    }}
                    required
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="">Select department...</option>
                    {departmentOptions.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                {deptDropdown === 'Other' && (
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      Custom Department <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="text"
                      value={customDept}
                      onChange={(e) => setCustomDept(e.target.value)}
                      required
                      placeholder="Enter department name"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Sub Category
                  </label>
                  <select
                    value={subDropdown}
                    onChange={(e) => setSubDropdown(e.target.value)}
                    disabled={!deptDropdown}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 disabled:bg-slate-50 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="">
                      {deptDropdown ? '— Optional —' : 'Select department first'}
                    </option>
                    {subCategoryOptions.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                {subDropdown === 'Other' && (
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      Custom Sub Category
                    </label>
                    <input
                      type="text"
                      value={customSub}
                      onChange={(e) => setCustomSub(e.target.value)}
                      placeholder="Enter sub category"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      Status
                    </label>
                    <select
                      value={serviceStatus}
                      onChange={(e) => setServiceStatus(e.target.value as CaseStatus)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      {CASE_STATUS_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      Fees (PKR)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={feesInput}
                      onChange={(e) => setFeesInput(e.target.value)}
                      placeholder="0"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-mono text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </div>
              </>
            )}

            {module === 'ledger' && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      Date <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="date"
                      value={ledgerDate}
                      onChange={(e) => setLedgerDate(e.target.value)}
                      required
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      Entry Type <span className="text-red-600">*</span>
                    </label>
                    <select
                      value={ledgerType}
                      onChange={(e) =>
                        setLedgerType(e.target.value as 'debit' | 'credit')
                      }
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      <option value="debit">Debit (Receivable / Fee)</option>
                      <option value="credit">Credit (Payment Received)</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Description <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={ledgerDesc}
                    onChange={(e) => setLedgerDesc(e.target.value)}
                    required
                    placeholder="e.g. Company registration fee or advance payment"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Amount (PKR) <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    value={ledgerAmount}
                    onChange={(e) => setLedgerAmount(e.target.value)}
                    required
                    placeholder="0"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-mono text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </>
            )}
          </div>

          <div className="px-6 py-4 border-t border-slate-200 bg-white flex items-center justify-end gap-3 shrink-0">
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
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-60 cursor-pointer"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
