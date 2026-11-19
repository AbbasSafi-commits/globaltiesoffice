import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Briefcase, Pencil, Plus, Settings2, Trash2, X } from 'lucide-react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import {
  CASE_STATUS_OPTIONS,
  CaseRecord,
  CaseStatus,
  DEFAULT_SERVICE_DEPARTMENTS,
  logClientActivity,
  ServiceDepartmentRecord,
} from './clientTypes';
import { ManageDepartmentsModal } from './ManageDepartmentsModal';

interface ClientServicesTabProps {
  clientId: string;
  clientName: string;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}

function getCaseStatusBadgeClass(status: CaseStatus): string {
  switch (status) {
    case 'Completed':
      return 'bg-emerald-50 text-emerald-700';
    case 'In Progress':
      return 'bg-blue-50 text-primary';
    case 'Submitted':
      return 'bg-amber-50 text-amber-800';
    case 'Rejected':
      return 'bg-red-50 text-red-700';
    case 'Not Started':
    default:
      return 'bg-slate-100 text-slate-600';
  }
}

function formatPkr(fees: number | null | undefined): string {
  if (fees === null || fees === undefined || Number.isNaN(fees)) return '—';
  return `PKR ${fees.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function formatDatesSummary(item: CaseRecord): string {
  const parts: string[] = [];
  if (item.startDate) parts.push(`Start: ${item.startDate}`);
  if (item.expectedDate) parts.push(`Exp: ${item.expectedDate}`);
  if (item.completedDate) parts.push(`Done: ${item.completedDate}`);
  return parts.length > 0 ? parts.join(' · ') : '—';
}

/**
 * Rebuilt Services tab in the Client Profile.
 * Uses Firestore "cases" for client services and "serviceDepartments" for
 * super-admin-managed departments and sub categories.
 */
export function ClientServicesTab({
  clientId,
  clientName,
  onSuccess,
  onError,
}: ClientServicesTabProps) {
  const { profile, isSuperAdmin, can } = useAuth();
  const currentUserEmail = (profile?.email || '').toLowerCase();

  const canAdd = can('clients', 'add');
  const canEdit = can('clients', 'edit');
  const canDelete = can('clients', 'delete');

  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [departments, setDepartments] = useState<ServiceDepartmentRecord[]>([]);
  const seededRef = useRef(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [manageModalOpen, setManageModalOpen] = useState(false);
  const [editingCase, setEditingCase] = useState<CaseRecord | null>(null);
  const [deletingCase, setDeletingCase] = useState<CaseRecord | null>(null);

  // Service form state
  const [deptDropdown, setDeptDropdown] = useState('');
  const [customDept, setCustomDept] = useState('');
  const [subDropdown, setSubDropdown] = useState('');
  const [customSub, setCustomSub] = useState('');
  const [status, setStatus] = useState<CaseStatus>('Not Started');
  const [feesInput, setFeesInput] = useState('');
  const [startDate, setStartDate] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [completedDate, setCompletedDate] = useState('');
  const [notes, setNotes] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Subscribe to client's cases
  useEffect(() => {
    const casesQuery = query(
      collection(db, 'cases'),
      where('clientId', '==', clientId)
    );

    const unsubscribe = onSnapshot(
      casesQuery,
      (snapshot) => {
        const list: CaseRecord[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<CaseRecord, 'id'>),
        }));

        list.sort((a, b) => {
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

        setCases(list);
        setLoading(false);
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.LIST, 'cases');
        } catch {
          onError('Unable to load client services. Please check your permissions.');
          setLoading(false);
        }
      }
    );

    return () => unsubscribe();
  }, [clientId, onError]);

  // Subscribe to managed serviceDepartments; auto-seed defaults once if empty (super admin)
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'serviceDepartments'),
      (snapshot) => {
        if (snapshot.empty && isSuperAdmin && !seededRef.current) {
          seededRef.current = true;
          Promise.all(
            DEFAULT_SERVICE_DEPARTMENTS.map((name, index) =>
              addDoc(collection(db, 'serviceDepartments'), {
                name,
                subCategories: [],
                sortOrder: index,
              })
            )
          ).catch((seedErr) => {
            console.error('Failed to seed default serviceDepartments:', seedErr);
          });
          return;
        }

        const list: ServiceDepartmentRecord[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data() as Partial<ServiceDepartmentRecord>;
          return {
            id: docSnap.id,
            name: data.name || '',
            subCategories: Array.isArray(data.subCategories) ? data.subCategories : [],
            sortOrder: typeof data.sortOrder === 'number' ? data.sortOrder : 0,
          };
        });

        list.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
        setDepartments(list);
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.LIST, 'serviceDepartments');
        } catch {
          // Fallback to default department names in dropdown if read fails
        }
      }
    );

    return () => unsubscribe();
  }, [isSuperAdmin]);

  // Department options for the dropdown (always ending with "Other")
  const departmentOptions = useMemo(() => {
    const names =
      departments.length > 0
        ? departments.map((d) => d.name).filter((n) => n && n !== 'Other')
        : DEFAULT_SERVICE_DEPARTMENTS.filter((n) => n !== 'Other');
    return [...names, 'Other'];
  }, [departments]);

  // Sub category options for the currently selected department (always ending with "Other")
  const subCategoryOptions = useMemo(() => {
    if (!deptDropdown || deptDropdown === 'Other') {
      return ['Other'];
    }
    const matched = departments.find((d) => d.name === deptDropdown);
    const subs = (matched?.subCategories || []).filter((s) => s && s !== 'Other');
    return [...subs, 'Other'];
  }, [departments, deptDropdown]);

  // Total fees across all services for this client
  const totalFees = useMemo(() => {
    return cases.reduce((sum, item) => {
      if (typeof item.fees === 'number' && !Number.isNaN(item.fees)) {
        return sum + item.fees;
      }
      return sum;
    }, 0);
  }, [cases]);

  const openAddModal = () => {
    setEditingCase(null);
    setDeptDropdown('');
    setCustomDept('');
    setSubDropdown('');
    setCustomSub('');
    setStatus('Not Started');
    setFeesInput('');
    setStartDate('');
    setExpectedDate('');
    setCompletedDate('');
    setNotes('');
    setValidationError(null);
    setModalOpen(true);
  };

  const openEditModal = (item: CaseRecord) => {
    setEditingCase(item);

    const existingDept = item.department || item.serviceName || '';
    const isKnownDept = departmentOptions.includes(existingDept) && existingDept !== 'Other';
    if (!existingDept) {
      setDeptDropdown('');
      setCustomDept('');
    } else if (isKnownDept) {
      setDeptDropdown(existingDept);
      setCustomDept('');
    } else {
      setDeptDropdown('Other');
      setCustomDept(existingDept);
    }

    const matchedDeptObj = departments.find((d) => d.name === existingDept);
    const knownSubs = matchedDeptObj?.subCategories || [];
    const existingSub = item.subCategory || '';
    if (!existingSub) {
      setSubDropdown('');
      setCustomSub('');
    } else if (knownSubs.includes(existingSub) && existingSub !== 'Other') {
      setSubDropdown(existingSub);
      setCustomSub('');
    } else {
      setSubDropdown('Other');
      setCustomSub(existingSub);
    }

    setStatus(item.status || 'Not Started');
    setFeesInput(
      item.fees !== null && item.fees !== undefined ? String(item.fees) : ''
    );
    setStartDate(item.startDate || '');
    setExpectedDate(item.expectedDate || '');
    setCompletedDate(item.completedDate || '');
    setNotes(item.notes || '');
    setValidationError(null);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    const resolvedDept =
      deptDropdown === 'Other' ? customDept.trim() : deptDropdown.trim();
    const resolvedSub =
      subDropdown === 'Other' ? customSub.trim() : subDropdown.trim();
    const cleanNotes = notes.trim();
    const cleanFees = feesInput.trim();

    if (!resolvedDept) {
      setValidationError('Login Department is required.');
      return;
    }

    let parsedFees: number | null = null;
    if (cleanFees !== '') {
      parsedFees = Number(cleanFees);
      if (Number.isNaN(parsedFees) || parsedFees < 0) {
        setValidationError('Fees must be a valid non-negative number.');
        return;
      }
    }

    if (startDate && expectedDate && expectedDate < startDate) {
      setValidationError('Expected Date cannot be earlier than Start Date.');
      return;
    }
    if (startDate && completedDate && completedDate < startDate) {
      setValidationError('Completed Date cannot be earlier than Start Date.');
      return;
    }

    setValidationError(null);
    setSaving(true);

    const displayLabel = resolvedSub
      ? `${resolvedDept} - ${resolvedSub}`
      : resolvedDept;

    const payloadBase = {
      clientId,
      department: resolvedDept,
      subCategory: resolvedSub,
      serviceName: displayLabel,
      status,
      fees: parsedFees,
      startDate,
      expectedDate,
      completedDate,
      notes: cleanNotes,
      updatedAt: serverTimestamp(),
      updatedBy: currentUserEmail,
    };

    try {
      if (editingCase) {
        const casePath = `cases/${editingCase.id}`;
        try {
          await updateDoc(doc(db, 'cases', editingCase.id), payloadBase);
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, casePath);
        }

        await logClientActivity({
          userEmail: currentUserEmail,
          action: 'updated_case',
          module: 'clients',
          targetId: editingCase.id,
          details: `Updated service "${displayLabel}" (${status}) for client "${clientName}"`,
        });

        onSuccess(`Service "${displayLabel}" updated.`);
      } else {
        let createdId = '';
        try {
          const docRef = await addDoc(collection(db, 'cases'), {
            ...payloadBase,
            createdAt: serverTimestamp(),
            createdBy: currentUserEmail,
          });
          createdId = docRef.id;
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, 'cases');
        }

        await logClientActivity({
          userEmail: currentUserEmail,
          action: 'added_case',
          module: 'clients',
          targetId: createdId,
          details: `Added service "${displayLabel}" (${status}) for client "${clientName}"`,
        });

        onSuccess(`Service "${displayLabel}" added.`);
      }

      setModalOpen(false);
    } catch (err) {
      console.error('Failed to save service:', err);
      onError('Unable to save service due to a Firestore permission error.');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingCase || !canDelete) return;
    setDeleting(true);
    const casePath = `cases/${deletingCase.id}`;
    const label =
      deletingCase.department || deletingCase.serviceName || 'Service';

    try {
      try {
        await deleteDoc(doc(db, 'cases', deletingCase.id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, casePath);
      }

      await logClientActivity({
        userEmail: currentUserEmail,
        action: 'deleted_case',
        module: 'clients',
        targetId: deletingCase.id,
        details: `Deleted service "${label}" for client "${clientName}"`,
      });

      onSuccess(`Service "${label}" deleted.`);
      setDeletingCase(null);
    } catch (err) {
      console.error('Failed to delete service:', err);
      onError('Could not delete service due to a Firestore permission error.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        {/* Header Bar */}
        <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-sm font-semibold text-slate-900">
                Client Services ({cases.length})
              </h2>
              <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-mono font-semibold text-primary">
                Total Fees: {formatPkr(totalFees)}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Track department services, sub categories, progress, dates, and PKR fees.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {isSuperAdmin && (
              <button
                type="button"
                onClick={() => setManageModalOpen(true)}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-primary hover:bg-slate-50 transition-colors whitespace-nowrap cursor-pointer"
              >
                <Settings2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Manage Departments</span>
              </button>
            )}

            {canAdd && (
              <button
                type="button"
                onClick={openAddModal}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-medium text-white hover:bg-primary-hover transition-colors whitespace-nowrap shadow-xs cursor-pointer"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                <span>Add Service</span>
              </button>
            )}
          </div>
        </div>

        {/* Table / Empty / Loading */}
        {loading ? (
          <div className="p-6 space-y-3" aria-busy="true">
            {[1, 2, 3].map((row) => (
              <div key={row} className="h-11 w-full rounded-lg bg-slate-100 animate-pulse" />
            ))}
          </div>
        ) : cases.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-500">
              <Briefcase className="h-5 w-5" aria-hidden="true" />
            </div>
            <p className="text-sm font-medium text-slate-900">No services added yet</p>
            <p className="mt-1 text-sm text-slate-500">
              Add a service under FBR, SECP, Excise &amp; Taxation, Land Registry, Visa, or another department.
            </p>
            {canAdd && (
              <button
                type="button"
                onClick={openAddModal}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover transition-colors shadow-xs cursor-pointer"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                <span>Add First Service</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] table-fixed text-left text-sm">
              <thead className="bg-table-head border-b border-border">
                <tr className="text-xs font-medium text-slate-600">
                  <th className="w-[18%] px-4 py-3.5">Department</th>
                  <th className="w-[20%] px-4 py-3.5">Sub Category</th>
                  <th className="w-[13%] px-4 py-3.5">Status</th>
                  <th className="w-[14%] px-4 py-3.5 text-right">Fees</th>
                  <th className="w-[21%] px-4 py-3.5">Dates</th>
                  {(canEdit || canDelete) && (
                    <th className="w-[14%] px-4 py-3.5 text-right">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cases.map((item) => {
                  const deptLabel = item.department || item.serviceName || '—';
                  const subLabel = item.subCategory || '—';
                  const datesText = formatDatesSummary(item);

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3.5">
                        <div
                          className="font-medium text-slate-900 truncate"
                          title={deptLabel}
                        >
                          {deptLabel}
                        </div>
                        {item.notes && (
                          <div
                            className="text-[11px] text-slate-500 truncate mt-0.5"
                            title={item.notes}
                          >
                            {item.notes}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="text-slate-700 truncate" title={subLabel}>
                          {subLabel}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getCaseStatusBadgeClass(
                            item.status
                          )}`}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs tabular-nums text-slate-900 text-right whitespace-nowrap">
                        {formatPkr(item.fees)}
                      </td>
                      <td className="px-4 py-3.5">
                        <div
                          className="font-mono text-xs tabular-nums text-slate-600 truncate"
                          title={datesText}
                        >
                          {datesText}
                        </div>
                      </td>
                      {(canEdit || canDelete) && (
                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            {canEdit && (
                              <button
                                type="button"
                                onClick={() => openEditModal(item)}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                              >
                                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                                <span>Edit</span>
                              </button>
                            )}
                            {canDelete && (
                              <button
                                type="button"
                                onClick={() => setDeletingCase(item)}
                                className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
                              >
                                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                                <span>Delete</span>
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-50/90 border-t border-slate-200">
                <tr>
                  <td
                    colSpan={3}
                    className="px-4 py-3 text-xs font-semibold text-slate-700 text-right"
                  >
                    Total Fees
                  </td>
                  <td className="px-4 py-3 font-mono text-xs font-semibold tabular-nums text-primary text-right whitespace-nowrap">
                    {formatPkr(totalFees)}
                  </td>
                  <td colSpan={canEdit || canDelete ? 2 : 1} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Service Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-[1px] p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="case-modal-title"
        >
          <div className="w-full max-w-xl max-h-[90vh] flex flex-col bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white shrink-0">
              <div>
                <h3
                  id="case-modal-title"
                  className="text-base font-semibold text-slate-900"
                >
                  {editingCase ? 'Edit Service' : 'Add Service'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Client: {clientName}</p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                disabled={saving}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
                aria-label="Close service modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="flex flex-col flex-1 min-h-0">
              <div className="p-6 space-y-4 overflow-y-auto flex-1">
                {validationError && (
                  <div
                    className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
                    role="alert"
                  >
                    {validationError}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Login Department (Required) */}
                  <div className="sm:col-span-2">
                    <label
                      htmlFor="case-department"
                      className="block text-xs font-medium text-slate-700 mb-1.5"
                    >
                      Login Department <span className="text-red-600">*</span>
                    </label>
                    <select
                      id="case-department"
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
                      {departmentOptions.map((deptName) => (
                        <option key={deptName} value={deptName}>
                          {deptName}
                        </option>
                      ))}
                    </select>
                  </div>

                  {deptDropdown === 'Other' && (
                    <div className="sm:col-span-2">
                      <label
                        htmlFor="case-custom-department"
                        className="block text-xs font-medium text-slate-700 mb-1.5"
                      >
                        Custom Department <span className="text-red-600">*</span>
                      </label>
                      <input
                        id="case-custom-department"
                        type="text"
                        value={customDept}
                        onChange={(e) => setCustomDept(e.target.value)}
                        maxLength={100}
                        required
                        placeholder="Enter department name"
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                  )}

                  {/* Sub Category (Optional, depends on Department) */}
                  <div className="sm:col-span-2">
                    <label
                      htmlFor="case-subcategory"
                      className="block text-xs font-medium text-slate-700 mb-1.5"
                    >
                      Sub Category
                    </label>
                    <select
                      id="case-subcategory"
                      value={subDropdown}
                      onChange={(e) => setSubDropdown(e.target.value)}
                      disabled={!deptDropdown}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 disabled:bg-slate-50 disabled:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      <option value="">
                        {deptDropdown
                          ? '— Select Sub Category (Optional) —'
                          : 'Select a department first'}
                      </option>
                      {subCategoryOptions.map((sub) => (
                        <option key={sub} value={sub}>
                          {sub}
                        </option>
                      ))}
                    </select>
                  </div>

                  {subDropdown === 'Other' && (
                    <div className="sm:col-span-2">
                      <label
                        htmlFor="case-custom-subcategory"
                        className="block text-xs font-medium text-slate-700 mb-1.5"
                      >
                        Custom Sub Category
                      </label>
                      <input
                        id="case-custom-subcategory"
                        type="text"
                        value={customSub}
                        onChange={(e) => setCustomSub(e.target.value)}
                        maxLength={120}
                        placeholder="Enter custom sub category"
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                  )}

                  {/* Status */}
                  <div>
                    <label
                      htmlFor="case-status"
                      className="block text-xs font-medium text-slate-700 mb-1.5"
                    >
                      Status
                    </label>
                    <select
                      id="case-status"
                      value={status}
                      onChange={(e) => setStatus(e.target.value as CaseStatus)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      {CASE_STATUS_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Fees (PKR) */}
                  <div>
                    <label
                      htmlFor="case-fees"
                      className="block text-xs font-medium text-slate-700 mb-1.5"
                    >
                      Fees (PKR)
                    </label>
                    <input
                      id="case-fees"
                      type="number"
                      min="0"
                      step="any"
                      value={feesInput}
                      onChange={(e) => setFeesInput(e.target.value)}
                      placeholder="0"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-mono tabular-nums text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>

                  {/* Dates */}
                  <div>
                    <label
                      htmlFor="case-start-date"
                      className="block text-xs font-medium text-slate-700 mb-1.5"
                    >
                      Start Date
                    </label>
                    <input
                      id="case-start-date"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="case-expected-date"
                      className="block text-xs font-medium text-slate-700 mb-1.5"
                    >
                      Expected Date
                    </label>
                    <input
                      id="case-expected-date"
                      type="date"
                      value={expectedDate}
                      onChange={(e) => setExpectedDate(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label
                      htmlFor="case-completed-date"
                      className="block text-xs font-medium text-slate-700 mb-1.5"
                    >
                      Completed Date
                    </label>
                    <input
                      id="case-completed-date"
                      type="date"
                      value={completedDate}
                      onChange={(e) => setCompletedDate(e.target.value)}
                      className="w-full sm:w-1/2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>

                  {/* Notes */}
                  <div className="sm:col-span-2">
                    <label
                      htmlFor="case-notes"
                      className="block text-xs font-medium text-slate-700 mb-1.5"
                    >
                      Notes
                    </label>
                    <textarea
                      id="case-notes"
                      rows={3}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      maxLength={2000}
                      placeholder="Service remarks, filing references, or next steps..."
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </div>
              </div>

              <div className="sticky bottom-0 shrink-0 px-6 py-4 border-t border-slate-200 bg-white flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  disabled={saving}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-60 transition-colors shadow-xs cursor-pointer"
                >
                  {saving ? 'Saving...' : editingCase ? 'Save Changes' : 'Add Service'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manage Departments Modal (Super Admins Only) */}
      {manageModalOpen && isSuperAdmin && (
        <ManageDepartmentsModal
          departments={departments}
          onClose={() => setManageModalOpen(false)}
          onSuccess={onSuccess}
          onError={onError}
        />
      )}

      {/* Delete Service Confirmation */}
      {deletingCase && canDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-[1px] p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-case-title"
        >
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
            <div className="p-6 space-y-2">
              <h3
                id="delete-case-title"
                className="text-base font-semibold text-slate-900"
              >
                Delete service &ldquo;
                {deletingCase.department || deletingCase.serviceName || 'Service'}
                &rdquo;?
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                This permanently removes this service record from {clientName}&apos;s profile.
              </p>
            </div>
            <div className="px-6 py-4 bg-slate-50/80 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeletingCase(null)}
                disabled={deleting}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60 transition-colors cursor-pointer"
              >
                {deleting ? 'Deleting...' : 'Delete Service'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
