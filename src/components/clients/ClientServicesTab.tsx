import React, { useEffect, useState } from 'react';
import { Briefcase, Pencil, Plus, Trash2, X } from 'lucide-react';
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
  logClientActivity,
  SUGGESTED_SERVICE_NAMES,
} from './clientTypes';

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

function formatFees(fees: number | null | undefined): string {
  if (fees === null || fees === undefined || Number.isNaN(fees)) return '—';
  return fees.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

/**
 * Services / Cases tab stored in Firestore "cases" collection filtered by clientId.
 */
export function ClientServicesTab({
  clientId,
  clientName,
  onSuccess,
  onError,
}: ClientServicesTabProps) {
  const { profile, can } = useAuth();
  const currentUserEmail = (profile?.email || '').toLowerCase();

  const canAdd = can('clients', 'add');
  const canEdit = can('clients', 'edit');
  const canDelete = can('clients', 'delete');

  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingCase, setEditingCase] = useState<CaseRecord | null>(null);
  const [deletingCase, setDeletingCase] = useState<CaseRecord | null>(null);

  // Form state
  const [serviceName, setServiceName] = useState('');
  const [status, setStatus] = useState<CaseStatus>('Not Started');
  const [startDate, setStartDate] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [completedDate, setCompletedDate] = useState('');
  const [feesInput, setFeesInput] = useState('');
  const [notes, setNotes] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

        // Sort newest first in memory so no composite index is required
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

  const openAddModal = () => {
    setEditingCase(null);
    setServiceName('');
    setStatus('Not Started');
    setStartDate('');
    setExpectedDate('');
    setCompletedDate('');
    setFeesInput('');
    setNotes('');
    setValidationError(null);
    setModalOpen(true);
  };

  const openEditModal = (item: CaseRecord) => {
    setEditingCase(item);
    setServiceName(item.serviceName || '');
    setStatus(item.status || 'Not Started');
    setStartDate(item.startDate || '');
    setExpectedDate(item.expectedDate || '');
    setCompletedDate(item.completedDate || '');
    setFeesInput(
      item.fees !== null && item.fees !== undefined ? String(item.fees) : ''
    );
    setNotes(item.notes || '');
    setValidationError(null);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanService = serviceName.trim();
    const cleanNotes = notes.trim();
    const cleanFees = feesInput.trim();

    if (!cleanService) {
      setValidationError('Service Name is required.');
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

    const payloadBase = {
      clientId,
      serviceName: cleanService,
      status,
      startDate,
      expectedDate,
      completedDate,
      fees: parsedFees,
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
          details: `Updated service "${cleanService}" (${status}) for client "${clientName}"`,
        });

        onSuccess(`Service "${cleanService}" updated.`);
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
          details: `Added service "${cleanService}" (${status}) for client "${clientName}"`,
        });

        onSuccess(`Service "${cleanService}" added.`);
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
        details: `Deleted service "${deletingCase.serviceName}" for client "${clientName}"`,
      });

      onSuccess(`Service "${deletingCase.serviceName}" deleted.`);
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
        <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Client Services &amp; Cases ({cases.length})
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Track registrations, filings, deadlines, completion dates, and agreed fees.
            </p>
          </div>

          {canAdd && (
            <button
              type="button"
              onClick={openAddModal}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-medium text-white hover:bg-primary-hover transition-colors whitespace-nowrap shrink-0 shadow-xs cursor-pointer"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span>Add Service</span>
            </button>
          )}
        </div>

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
              Add service cases such as Company Registration, Land Registry Transfer, or Student Visa.
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
          <div className="overflow-auto max-h-[540px]">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-xs border-b border-slate-200">
                <tr className="text-xs font-medium text-slate-500">
                  <th className="px-5 py-3.5 whitespace-nowrap">Service Name</th>
                  <th className="px-5 py-3.5 whitespace-nowrap">Status</th>
                  <th className="px-5 py-3.5 whitespace-nowrap">Start Date</th>
                  <th className="px-5 py-3.5 whitespace-nowrap">Expected Date</th>
                  <th className="px-5 py-3.5 whitespace-nowrap">Completed Date</th>
                  <th className="px-5 py-3.5 text-right whitespace-nowrap">Fees</th>
                  <th className="px-5 py-3.5">Notes</th>
                  {(canEdit || canDelete) && (
                    <th className="px-5 py-3.5 text-right whitespace-nowrap">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cases.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-slate-900 whitespace-nowrap">
                      {item.serviceName}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getCaseStatusBadgeClass(
                          item.status
                        )}`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs tabular-nums text-slate-600 whitespace-nowrap">
                      {item.startDate || '—'}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs tabular-nums text-slate-600 whitespace-nowrap">
                      {item.expectedDate || '—'}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs tabular-nums text-slate-600 whitespace-nowrap">
                      {item.completedDate || '—'}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs tabular-nums text-slate-900 text-right whitespace-nowrap">
                      {formatFees(item.fees)}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-600 max-w-[220px] truncate">
                      {item.notes || '—'}
                    </td>
                    {(canEdit || canDelete) && (
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
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
                ))}
              </tbody>
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
                  <div className="sm:col-span-2">
                    <label
                      htmlFor="case-service-name"
                      className="block text-xs font-medium text-slate-700 mb-1.5"
                    >
                      Service Name <span className="text-red-600">*</span>
                    </label>
                    <input
                      id="case-service-name"
                      type="text"
                      list="suggested-services"
                      value={serviceName}
                      onChange={(e) => setServiceName(e.target.value)}
                      maxLength={160}
                      required
                      placeholder="e.g. Company Registration, Land Registry Transfer, Student Visa"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                    <datalist id="suggested-services">
                      {SUGGESTED_SERVICE_NAMES.map((s) => (
                        <option key={s} value={s} />
                      ))}
                    </datalist>
                  </div>

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

                  <div>
                    <label
                      htmlFor="case-fees"
                      className="block text-xs font-medium text-slate-700 mb-1.5"
                    >
                      Fees
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
                Delete service &ldquo;{deletingCase.serviceName}&rdquo;?
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
