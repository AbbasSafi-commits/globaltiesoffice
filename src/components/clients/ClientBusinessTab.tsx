import React, { useEffect, useState } from 'react';
import { Building2, Pencil, Plus } from 'lucide-react';
import { doc, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import {
  BusinessDetailsRecord,
  formatClientDate,
  logClientActivity,
} from './clientTypes';

interface ClientBusinessTabProps {
  clientId: string;
  clientName: string;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}

/**
 * Business Details tab stored in Firestore at businessDetails/{clientId}.
 */
export function ClientBusinessTab({
  clientId,
  clientName,
  onSuccess,
  onError,
}: ClientBusinessTabProps) {
  const { profile, can } = useAuth();
  const currentUserEmail = (profile?.email || '').toLowerCase();

  const canAdd = can('business_details', 'add');
  const canEdit = can('business_details', 'edit');

  const [record, setRecord] = useState<BusinessDetailsRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [businessName, setBusinessName] = useState('');
  const [businessCategory, setBusinessCategory] = useState('');
  const [incNo, setIncNo] = useState('');
  const [notes, setNotes] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    const docPath = `businessDetails/${clientId}`;
    const unsubscribe = onSnapshot(
      doc(db, 'businessDetails', clientId),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as BusinessDetailsRecord;
          setRecord(data);
        } else {
          setRecord(null);
        }
        setLoading(false);
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.GET, docPath);
        } catch {
          onError('Unable to load business details. Please check your permissions.');
          setLoading(false);
        }
      }
    );

    return () => unsubscribe();
  }, [clientId, onError]);

  const openForm = (existing?: BusinessDetailsRecord | null) => {
    setBusinessName(existing?.businessName || '');
    setBusinessCategory(existing?.businessCategory || '');
    setIncNo(existing?.incNo || '');
    setNotes(existing?.notes || '');
    setValidationError(null);
    setEditing(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = businessName.trim();
    const cleanCategory = businessCategory.trim();
    const cleanIncNo = incNo.trim();
    const cleanNotes = notes.trim();

    if (!cleanName) {
      setValidationError('Business Name is required.');
      return;
    }

    setValidationError(null);
    setSaving(true);
    const docPath = `businessDetails/${clientId}`;
    const docRef = doc(db, 'businessDetails', clientId);

    try {
      if (record) {
        try {
          await updateDoc(docRef, {
            businessName: cleanName,
            businessCategory: cleanCategory,
            incNo: cleanIncNo,
            notes: cleanNotes,
            updatedAt: serverTimestamp(),
            updatedBy: currentUserEmail,
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, docPath);
        }

        await logClientActivity({
          userEmail: currentUserEmail,
          action: 'updated_business_details',
          module: 'business_details',
          targetId: clientId,
          details: `Updated business details "${cleanName}" for client "${clientName}"`,
        });

        onSuccess('Business details updated.');
      } else {
        try {
          await setDoc(docRef, {
            clientId,
            businessName: cleanName,
            businessCategory: cleanCategory,
            incNo: cleanIncNo,
            notes: cleanNotes,
            createdAt: serverTimestamp(),
            createdBy: currentUserEmail,
            updatedAt: serverTimestamp(),
            updatedBy: currentUserEmail,
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, docPath);
        }

        await logClientActivity({
          userEmail: currentUserEmail,
          action: 'added_business_details',
          module: 'business_details',
          targetId: clientId,
          details: `Added business details "${cleanName}" for client "${clientName}"`,
        });

        onSuccess('Business details saved.');
      }

      setEditing(false);
    } catch (err) {
      console.error('Failed to save business details:', err);
      onError('Unable to save business details due to a Firestore permission error.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3" aria-busy="true">
        <div className="h-5 w-48 rounded bg-slate-100 animate-pulse" />
        <div className="h-24 w-full rounded bg-slate-100 animate-pulse" />
      </div>
    );
  }

  if (editing) {
    return (
      <section className="bg-white border border-slate-200 rounded-xl p-6">
        <h2 className="font-display text-sm font-semibold text-[#0F2942] border-b border-slate-200 pb-3">
          {record ? 'Edit Business Details' : 'Add Business Details'}
        </h2>

        <form onSubmit={handleSave} className="mt-5 space-y-4">
          {validationError && (
            <div
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
              role="alert"
            >
              {validationError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label
                htmlFor="biz-name"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Business Name <span className="text-red-600">*</span>
              </label>
              <input
                id="biz-name"
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                maxLength={160}
                required
                placeholder="Registered business name"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#1D4ED8] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/15"
              />
            </div>

            <div>
              <label
                htmlFor="biz-category"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Business Category
              </label>
              <input
                id="biz-category"
                type="text"
                value={businessCategory}
                onChange={(e) => setBusinessCategory(e.target.value)}
                maxLength={120}
                placeholder="e.g. Sole Proprietor, Pvt Ltd, SMC"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#1D4ED8] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/15"
              />
            </div>

            <div>
              <label
                htmlFor="biz-inc"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                INC No
              </label>
              <input
                id="biz-inc"
                type="text"
                value={incNo}
                onChange={(e) => setIncNo(e.target.value)}
                maxLength={80}
                placeholder="Incorporation / Reg No"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono text-slate-900 placeholder:text-slate-400 focus:border-[#1D4ED8] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/15"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="biz-notes"
              className="block text-xs font-medium text-slate-700 mb-1.5"
            >
              Extra Notes
            </label>
            <textarea
              id="biz-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={2000}
              placeholder="Registration office, partners, or business remarks..."
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#1D4ED8] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/15"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setEditing(false)}
              disabled={saving}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-[#0F2942] px-5 py-2 text-sm font-medium text-white hover:bg-[#163859] disabled:opacity-60 transition-colors cursor-pointer"
            >
              {saving ? 'Saving...' : 'Save Business Details'}
            </button>
          </div>
        </form>
      </section>
    );
  }

  if (!record) {
    return (
      <section className="bg-white border border-slate-200 rounded-xl px-6 py-12 text-center">
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
          <Building2 className="h-5 w-5" aria-hidden="true" />
        </div>
        <h2 className="font-display text-sm font-semibold text-slate-900">
          No business details added yet
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Store company registration category, incorporation number, and notes for this client.
        </p>
        {canAdd && (
          <button
            type="button"
            onClick={() => openForm(null)}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#0F2942] px-4 py-2 text-sm font-medium text-white hover:bg-[#163859] transition-colors cursor-pointer"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>Add business details</span>
          </button>
        )}
      </section>
    );
  }

  return (
    <section className="bg-white border border-slate-200 rounded-xl p-6">
      <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-3">
        <h2 className="font-display text-sm font-semibold text-[#0F2942]">
          Business Details
        </h2>
        {canEdit && (
          <button
            type="button"
            onClick={() => openForm(record)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer"
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Edit</span>
          </button>
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div>
          <div className="text-xs font-medium text-slate-500">Business Name</div>
          <div className="mt-1 text-sm font-medium text-slate-900">{record.businessName}</div>
        </div>
        <div>
          <div className="text-xs font-medium text-slate-500">Business Category</div>
          <div className="mt-1 text-sm text-slate-900">{record.businessCategory || '—'}</div>
        </div>
        <div>
          <div className="text-xs font-medium text-slate-500">INC No</div>
          <div className="mt-1 text-sm font-mono tabular-nums text-slate-900">
            {record.incNo || '—'}
          </div>
        </div>
      </div>

      <div className="mt-5 pt-4 border-t border-slate-200 space-y-3">
        <div>
          <div className="text-xs font-medium text-slate-500">Extra Notes</div>
          <p className="mt-1 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
            {record.notes?.trim() ? record.notes : 'No extra notes recorded.'}
          </p>
        </div>

        <div className="text-xs text-slate-500">
          Last updated:{' '}
          <span className="font-mono text-slate-700">{formatClientDate(record.updatedAt)}</span>
          {record.updatedBy ? ` (${record.updatedBy})` : ''}
        </div>
      </div>
    </section>
  );
}
