import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';

export type LedgerEntryType = 'Debit' | 'Credit';

export type PaymentMethod =
  | 'Cash'
  | 'Bank Transfer'
  | 'Cheque'
  | 'Online'
  | 'Other';

export const PAYMENT_METHOD_OPTIONS: PaymentMethod[] = [
  'Cash',
  'Bank Transfer',
  'Cheque',
  'Online',
  'Other',
];

export interface LedgerEntryRecord {
  id: string;
  clientId: string;
  clientName: string;
  date: string; // YYYY-MM-DD
  description: string;
  type: LedgerEntryType;
  amount: number;
  paymentMethod: PaymentMethod;
  referenceNo?: string;
  createdAt?: { toDate?: () => Date } | null;
  createdBy?: string;
  updatedAt?: { toDate?: () => Date } | null;
  updatedBy?: string;
}

export interface LedgerRowWithBalance extends LedgerEntryRecord {
  runningBalance: number;
}

/**
 * Formats an amount in PKR with thousand separators.
 */
export function formatPkr(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Math.abs(safe));

  if (safe < 0) {
    return `-PKR ${formatted}`;
  }
  return `PKR ${formatted}`;
}

/**
 * Returns today's local date in YYYY-MM-DD format for date inputs.
 */
export function getTodayDateInput(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Sorts ledger entries chronologically by date ascending (and createdAt ascending),
 * computes running balance, and optionally applies a date range filter while
 * preserving accurate opening/closing balances.
 */
export function computeLedgerStatement(
  entries: LedgerEntryRecord[],
  fromDate: string,
  toDate: string
): {
  rows: LedgerRowWithBalance[];
  openingBalance: number;
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
} {
  const sorted = [...entries].sort((a, b) => {
    const dateCompare = (a.date || '').localeCompare(b.date || '');
    if (dateCompare !== 0) return dateCompare;
    const aTime =
      a.createdAt && typeof a.createdAt.toDate === 'function'
        ? a.createdAt.toDate().getTime()
        : 0;
    const bTime =
      b.createdAt && typeof b.createdAt.toDate === 'function'
        ? b.createdAt.toDate().getTime()
        : 0;
    return aTime - bTime;
  });

  let running = 0;
  let openingBalance = 0;
  let totalDebit = 0;
  let totalCredit = 0;
  const rows: LedgerRowWithBalance[] = [];

  for (const entry of sorted) {
    const amount = Number(entry.amount) || 0;
    const delta = entry.type === 'Debit' ? amount : -amount;

    if (fromDate && entry.date < fromDate) {
      running += delta;
      openingBalance = running;
      continue;
    }

    if (toDate && entry.date > toDate) {
      continue;
    }

    running += delta;
    if (entry.type === 'Debit') {
      totalDebit += amount;
    } else {
      totalCredit += amount;
    }

    rows.push({
      ...entry,
      runningBalance: running,
    });
  }

  return {
    rows,
    openingBalance,
    totalDebit,
    totalCredit,
    closingBalance: running,
  };
}

/**
 * Escapes CSV values safely and triggers a browser file download.
 */
export function exportLedgerCsv(params: {
  clientName: string;
  rows: LedgerRowWithBalance[];
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
}): void {
  const escapeCell = (val: string | number) => {
    const str = String(val ?? '');
    if (/[",\n]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const header = [
    'Date',
    'Description',
    'Type',
    'Payment Method',
    'Reference No',
    'Debit (PKR)',
    'Credit (PKR)',
    'Running Balance (PKR)',
  ];

  const lines = [
    header.map(escapeCell).join(','),
    ...params.rows.map((row) =>
      [
        row.date,
        row.description,
        row.type,
        row.paymentMethod,
        row.referenceNo || '',
        row.type === 'Debit' ? row.amount : 0,
        row.type === 'Credit' ? row.amount : 0,
        row.runningBalance,
      ]
        .map(escapeCell)
        .join(',')
    ),
    [
      'TOTAL',
      '',
      '',
      '',
      '',
      params.totalDebit,
      params.totalCredit,
      params.closingBalance,
    ]
      .map(escapeCell)
      .join(','),
  ];

  const csvContent = `\uFEFF${lines.join('\n')}`;
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const safeName = params.clientName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `ledger-${safeName || 'client'}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Writes an audit event to Firestore's activityLog collection for ledger changes.
 */
export async function logLedgerActivity(params: {
  userEmail: string;
  action: 'added_ledger_entry' | 'updated_ledger_entry' | 'deleted_ledger_entry';
  clientId: string;
  targetId: string;
  details: string;
}): Promise<void> {
  try {
    await addDoc(collection(db, 'activityLog'), {
      userEmail: params.userEmail.toLowerCase(),
      action: params.action,
      module: 'ledger',
      clientId: params.clientId,
      targetId: params.targetId,
      details: params.details,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, 'activityLog');
  }
}
