import { useEffect, useState } from 'react';
import {
  BookOpen,
  Download,
  Pencil,
  Plus,
  Printer,
  Trash2,
} from 'lucide-react';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { LedgerEntryModal } from './LedgerEntryModal';
import { LedgerStatementModal } from './LedgerStatementModal';
import {
  computeLedgerStatement,
  exportLedgerCsv,
  formatPkr,
  LedgerEntryRecord,
  logLedgerActivity,
} from './ledgerTypes';

interface ClientLedgerTabProps {
  clientId: string;
  clientName: string;
  clientMobile: string;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}

/**
 * Client Ledger tab inside /clients/:id displaying summary cards, running balance,
 * date range filter, print/PDF statement, CSV export, and CRUD actions.
 */
export function ClientLedgerTab({
  clientId,
  clientName,
  clientMobile,
  onSuccess,
  onError,
}: ClientLedgerTabProps) {
  const { profile, can } = useAuth();
  const currentUserEmail = (profile?.email || '').toLowerCase();

  const canAdd = can('ledger', 'add');
  const canEdit = can('ledger', 'edit');
  const canDelete = can('ledger', 'delete');

  const [entries, setEntries] = useState<LedgerEntryRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<LedgerEntryRecord | null>(null);
  const [deletingEntry, setDeletingEntry] = useState<LedgerEntryRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showStatementModal, setShowStatementModal] = useState(false);

  useEffect(() => {
    const ledgerQuery = query(
      collection(db, 'ledger'),
      where('clientId', '==', clientId)
    );

    const unsubscribe = onSnapshot(
      ledgerQuery,
      (snapshot) => {
        const list: LedgerEntryRecord[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<LedgerEntryRecord, 'id'>),
        }));
        setEntries(list);
        setLoading(false);
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.LIST, 'ledger');
        } catch {
          onError('Unable to load ledger entries. Please check your permissions.');
          setLoading(false);
        }
      }
    );

    return () => unsubscribe();
  }, [clientId, onError]);

  const statement = computeLedgerStatement(entries, fromDate, toDate);
  const allTimeStatement = computeLedgerStatement(entries, '', '');

  const handleConfirmDelete = async () => {
    if (!deletingEntry || !canDelete) return;
    setDeleting(true);
    const docPath = `ledger/${deletingEntry.id}`;

    try {
      try {
        await deleteDoc(doc(db, 'ledger', deletingEntry.id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, docPath);
      }

      await logLedgerActivity({
        userEmail: currentUserEmail,
        action: 'deleted_ledger_entry',
        clientId,
        targetId: deletingEntry.id,
        details: `Deleted ${deletingEntry.type} entry (${formatPkr(deletingEntry.amount)}) - "${deletingEntry.description}" for "${clientName}"`,
      });

      onSuccess('Ledger entry deleted.');
      setDeletingEntry(null);
    } catch (err) {
      console.error('Failed to delete ledger entry:', err);
      onError('Could not delete ledger entry due to a Firestore permission error.');
    } finally {
      setDeleting(false);
    }
  };

  const handleExportCsv = () => {
    exportLedgerCsv({
      clientName,
      rows: statement.rows,
      totalDebit: statement.totalDebit,
      totalCredit: statement.totalCredit,
      closingBalance: statement.closingBalance,
    });
    onSuccess('Ledger exported to CSV.');
  };

  const balanceIsDue = allTimeStatement.closingBalance > 0;
  const balanceStatusText =
    allTimeStatement.closingBalance > 0
      ? 'Client owes balance'
      : allTimeStatement.closingBalance < 0
        ? 'Advance / Overpaid'
        : 'Account settled';

  return (
    <>
      <div className="space-y-6 print:hidden">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
            <div className="text-xs font-medium text-slate-500">Total Debit</div>
            <div className="mt-1.5 font-mono text-xl font-semibold tabular-nums text-slate-900">
              {formatPkr(allTimeStatement.totalDebit)}
            </div>
            <div className="mt-1 text-xs text-slate-500">Total services charged</div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
            <div className="text-xs font-medium text-slate-500">Total Credit</div>
            <div className="mt-1.5 font-mono text-xl font-semibold tabular-nums text-emerald-700">
              {formatPkr(allTimeStatement.totalCredit)}
            </div>
            <div className="mt-1 text-xs text-slate-500">Total payments received</div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
            <div className="text-xs font-medium text-slate-500">Balance Due</div>
            <div
              className={`mt-1.5 font-mono text-xl font-semibold tabular-nums ${
                balanceIsDue ? 'text-red-600' : 'text-emerald-700'
              }`}
            >
              {formatPkr(allTimeStatement.closingBalance)}
            </div>
            <div
              className={`mt-1 text-xs font-medium ${
                balanceIsDue ? 'text-red-600' : 'text-emerald-700'
              }`}
            >
              {balanceStatusText}
            </div>
          </div>
        </div>

        {/* Ledger Controls & Table */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <div className="p-4 sm:px-6 sm:py-4 border-b border-slate-100 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
            {/* Date Range Filter */}
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center gap-2">
                <label htmlFor="ledger-from" className="text-xs font-medium text-slate-600">
                  From
                </label>
                <input
                  id="ledger-from"
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="flex items-center gap-2">
                <label htmlFor="ledger-to" className="text-xs font-medium text-slate-600">
                  To
                </label>
                <input
                  id="ledger-to"
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              {(fromDate || toDate) && (
                <button
                  type="button"
                  onClick={() => {
                    setFromDate('');
                    setToDate('');
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowStatementModal(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap cursor-pointer"
              >
                <Printer className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Print / Download PDF</span>
              </button>

              <button
                type="button"
                onClick={handleExportCsv}
                disabled={statement.rows.length === 0}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Export to Excel (CSV)</span>
              </button>

              {canAdd && (
                <button
                  type="button"
                  onClick={() => setShowAddModal(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-medium text-white hover:bg-primary-hover transition-colors whitespace-nowrap shadow-xs cursor-pointer"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  <span>Add Entry</span>
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <div className="p-6 space-y-3" aria-busy="true">
              {[1, 2, 3].map((row) => (
                <div key={row} className="h-11 w-full rounded-lg bg-slate-100 animate-pulse" />
              ))}
            </div>
          ) : entries.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                <BookOpen className="h-5 w-5" aria-hidden="true" />
              </div>
              <p className="text-sm font-medium text-slate-900">
                No ledger entries recorded yet
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Record service charges (Debit) and payments received (Credit) to track this client&apos;s balance.
              </p>
              {canAdd && (
                <button
                  type="button"
                  onClick={() => setShowAddModal(true)}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover transition-colors shadow-xs cursor-pointer"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  <span>Add First Entry</span>
                </button>
              )}
            </div>
          ) : statement.rows.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                <BookOpen className="h-5 w-5" aria-hidden="true" />
              </div>
              <p className="text-sm font-medium text-slate-900">
                No entries in selected date range
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Adjust or clear the From / To dates to view all transactions.
              </p>
            </div>
          ) : (
            <div className="overflow-auto max-h-[540px]">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-xs border-b border-slate-200">
                  <tr className="text-xs font-medium text-slate-500">
                    <th className="px-5 py-3.5 whitespace-nowrap">Date</th>
                    <th className="px-5 py-3.5">Description</th>
                    <th className="px-5 py-3.5 text-right whitespace-nowrap">Debit</th>
                    <th className="px-5 py-3.5 text-right whitespace-nowrap">Credit</th>
                    <th className="px-5 py-3.5 text-right whitespace-nowrap">Running Balance</th>
                    {(canEdit || canDelete) && (
                      <th className="px-5 py-3.5 text-right whitespace-nowrap">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {fromDate && statement.openingBalance !== 0 && (
                    <tr className="bg-slate-50/60">
                      <td className="px-5 py-3 font-mono text-xs text-slate-500 whitespace-nowrap">
                        {fromDate}
                      </td>
                      <td className="px-5 py-3 text-slate-600 italic">
                        Opening Balance (before {fromDate})
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-xs text-slate-400">
                        —
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-xs text-slate-400">
                        —
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-xs font-medium tabular-nums text-slate-900 whitespace-nowrap">
                        {formatPkr(statement.openingBalance)}
                      </td>
                      {(canEdit || canDelete) && <td className="px-5 py-3" />}
                    </tr>
                  )}

                  {statement.rows.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-3.5 font-mono text-xs tabular-nums text-slate-700 whitespace-nowrap">
                        {row.date}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="font-medium text-slate-900">{row.description}</div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {row.paymentMethod}
                          {row.referenceNo ? ` · Ref: ${row.referenceNo}` : ''}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono text-xs tabular-nums text-slate-900 whitespace-nowrap">
                        {row.type === 'Debit' ? formatPkr(row.amount) : '—'}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono text-xs tabular-nums text-emerald-700 whitespace-nowrap">
                        {row.type === 'Credit' ? formatPkr(row.amount) : '—'}
                      </td>
                      <td
                        className={`px-5 py-3.5 text-right font-mono text-xs font-semibold tabular-nums whitespace-nowrap ${
                          row.runningBalance > 0 ? 'text-red-600' : 'text-emerald-700'
                        }`}
                      >
                        {formatPkr(row.runningBalance)}
                      </td>
                      {(canEdit || canDelete) && (
                        <td className="px-5 py-3.5 text-right whitespace-nowrap">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            {canEdit && (
                              <button
                                type="button"
                                onClick={() => setEditingEntry(row)}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                              >
                                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                                <span>Edit</span>
                              </button>
                            )}
                            {canDelete && (
                              <button
                                type="button"
                                onClick={() => setDeletingEntry(row)}
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
      </div>

      {/* Add Entry Modal */}
      {showAddModal && canAdd && (
        <LedgerEntryModal
          clientId={clientId}
          clientName={clientName}
          currentUserEmail={currentUserEmail}
          onClose={() => setShowAddModal(false)}
          onSuccess={onSuccess}
          onError={onError}
        />
      )}

      {/* Edit Entry Modal */}
      {editingEntry && canEdit && (
        <LedgerEntryModal
          clientId={clientId}
          clientName={clientName}
          existingEntry={editingEntry}
          currentUserEmail={currentUserEmail}
          onClose={() => setEditingEntry(null)}
          onSuccess={onSuccess}
          onError={onError}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {deletingEntry && canDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-[1px] p-4 print:hidden"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-ledger-title"
        >
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
            <div className="p-6 space-y-2">
              <h3
                id="delete-ledger-title"
                className="text-base font-semibold text-slate-900"
              >
                Delete ledger entry?
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                This will change the balance. Are you sure you want to delete the{' '}
                <span className="font-medium text-slate-900">{deletingEntry.type}</span> entry for{' '}
                <span className="font-mono font-medium text-slate-900">
                  {formatPkr(deletingEntry.amount)}
                </span>{' '}
                ({deletingEntry.description})?
              </p>
            </div>
            <div className="px-6 py-4 bg-slate-50/80 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeletingEntry(null)}
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
                {deleting ? 'Deleting...' : 'Delete Entry'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Printable Statement Modal */}
      {showStatementModal && (
        <LedgerStatementModal
          clientName={clientName}
          clientMobile={clientMobile}
          fromDate={fromDate}
          toDate={toDate}
          openingBalance={statement.openingBalance}
          rows={statement.rows}
          totalDebit={statement.totalDebit}
          totalCredit={statement.totalCredit}
          closingBalance={statement.closingBalance}
          onClose={() => setShowStatementModal(false)}
        />
      )}
    </>
  );
}
