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
  formatPkr,
  getTodayDateInput,
  LedgerEntryRecord,
  LedgerEntryType,
  logLedgerActivity,
  PAYMENT_METHOD_OPTIONS,
  PaymentMethod,
} from './ledgerTypes';

interface LedgerEntryModalProps {
  clientId: string;
  clientName: string;
  existingEntry?: LedgerEntryRecord | null;
  currentUserEmail: string;
  onClose: () => void;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}

/**
 * Modal for adding or editing a client ledger entry (Debit or Credit in PKR).
 */
export function LedgerEntryModal({
  clientId,
  clientName,
  existingEntry,
  currentUserEmail,
  onClose,
  onSuccess,
  onError,
}: LedgerEntryModalProps) {
  const isEditMode = Boolean(existingEntry);

  const [date, setDate] = useState(existingEntry?.date || getTodayDateInput());
  const [type, setType] = useState<LedgerEntryType>(existingEntry?.type || 'Debit');
  const [description, setDescription] = useState(existingEntry?.description || '');
  const [amountInput, setAmountInput] = useState(
    existingEntry ? String(existingEntry.amount) : ''
  );
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    existingEntry?.paymentMethod || 'Cash'
  );
  const [referenceNo, setReferenceNo] = useState(existingEntry?.referenceNo || '');

  const [validationError, setValidationError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanDate = date.trim();
    const cleanDescription = description.trim();
    const cleanRef = referenceNo.trim();
    const parsedAmount = Number(amountInput);

    if (!cleanDate) {
      setValidationError('Date is required.');
      return;
    }
    if (!cleanDescription) {
      setValidationError('Description is required.');
      return;
    }
    if (cleanDescription.length > 300) {
      setValidationError('Description must be 300 characters or fewer.');
      return;
    }
    if (!amountInput.trim() || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      setValidationError('Amount must be a positive number greater than 0.');
      return;
    }

    setValidationError(null);
    setSaving(true);

    const payloadBase = {
      clientId,
      clientName,
      date: cleanDate,
      description: cleanDescription,
      type,
      amount: Math.round(parsedAmount * 100) / 100,
      paymentMethod,
      referenceNo: cleanRef,
      updatedAt: serverTimestamp(),
      updatedBy: currentUserEmail.toLowerCase(),
    };

    try {
      if (isEditMode && existingEntry) {
        const entryPath = `ledger/${existingEntry.id}`;
        try {
          await updateDoc(doc(db, 'ledger', existingEntry.id), payloadBase);
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, entryPath);
        }

        await logLedgerActivity({
          userEmail: currentUserEmail,
          action: 'updated_ledger_entry',
          clientId,
          targetId: existingEntry.id,
          details: `Updated ${type} entry (${formatPkr(payloadBase.amount)}) - "${cleanDescription}" for "${clientName}"`,
        });

        onSuccess('Ledger entry updated.');
      } else {
        let createdId = '';
        try {
          const docRef = await addDoc(collection(db, 'ledger'), {
            ...payloadBase,
            createdAt: serverTimestamp(),
            createdBy: currentUserEmail.toLowerCase(),
          });
          createdId = docRef.id;
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, 'ledger');
        }

        await logLedgerActivity({
          userEmail: currentUserEmail,
          action: 'added_ledger_entry',
          clientId,
          targetId: createdId,
          details: `Added ${type} entry (${formatPkr(payloadBase.amount)}) - "${cleanDescription}" for "${clientName}"`,
        });

        onSuccess(`${type} entry (${formatPkr(payloadBase.amount)}) added.`);
      }

      onClose();
    } catch (err) {
      console.error('Failed to save ledger entry:', err);
      onError('Unable to save ledger entry due to a Firestore permission error.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/50 p-4 overflow-y-auto print:hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ledger-entry-modal-title"
    >
      <div className="w-full max-w-lg bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden my-8">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/70">
          <div>
            <h2
              id="ledger-entry-modal-title"
              className="font-display text-base font-semibold text-[#0F2942]"
            >
              {isEditMode ? 'Edit Ledger Entry' : 'Add Ledger Entry'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Client: {clientName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 cursor-pointer"
            aria-label="Close ledger modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {validationError && (
            <div
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
              role="alert"
            >
              {validationError}
            </div>
          )}

          {/* Type selector */}
          <div>
            <span className="block text-xs font-medium text-slate-700 mb-1.5">
              Entry Type <span className="text-red-600">*</span>
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setType('Debit')}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors cursor-pointer ${
                  type === 'Debit'
                    ? 'border-red-300 bg-red-50 text-red-800'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                Debit (Service Charged)
              </button>
              <button
                type="button"
                onClick={() => setType('Credit')}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors cursor-pointer ${
                  type === 'Credit'
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                Credit (Payment Received)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="ledger-date"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Date <span className="text-red-600">*</span>
              </label>
              <input
                id="ledger-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-[#1D4ED8] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/15"
              />
            </div>

            <div>
              <label
                htmlFor="ledger-amount"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Amount (PKR) <span className="text-red-600">*</span>
              </label>
              <input
                id="ledger-amount"
                type="number"
                min="0.01"
                step="any"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                required
                placeholder="e.g. 25000"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono tabular-nums text-slate-900 placeholder:text-slate-400 focus:border-[#1D4ED8] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/15"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="ledger-description"
              className="block text-xs font-medium text-slate-700 mb-1.5"
            >
              Description <span className="text-red-600">*</span>
            </label>
            <input
              id="ledger-description"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={300}
              required
              placeholder="e.g. SECP Company Registration Fee / Advance Cash Payment"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#1D4ED8] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/15"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="ledger-method"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Payment Method
              </label>
              <select
                id="ledger-method"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#1D4ED8] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/15"
              >
                {PAYMENT_METHOD_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="ledger-reference"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Reference / Receipt No
              </label>
              <input
                id="ledger-reference"
                type="text"
                value={referenceNo}
                onChange={(e) => setReferenceNo(e.target.value)}
                maxLength={100}
                placeholder="Optional receipt or TXN ID"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono text-slate-900 placeholder:text-slate-400 focus:border-[#1D4ED8] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/15"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
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
              className="rounded-lg bg-[#0F2942] px-5 py-2 text-sm font-medium text-white hover:bg-[#163859] disabled:opacity-60 transition-colors cursor-pointer"
            >
              {saving
                ? 'Saving...'
                : isEditMode
                  ? 'Save Changes'
                  : 'Save Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
