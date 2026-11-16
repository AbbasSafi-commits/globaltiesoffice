import { Globe, Printer, X } from 'lucide-react';
import { formatPkr, LedgerRowWithBalance } from './ledgerTypes';

interface LedgerStatementModalProps {
  clientName: string;
  clientMobile: string;
  fromDate: string;
  toDate: string;
  openingBalance: number;
  rows: LedgerRowWithBalance[];
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
  onClose: () => void;
}

/**
 * Clean printable ledger statement modal for saving as PDF or printing.
 */
export function LedgerStatementModal({
  clientName,
  clientMobile,
  fromDate,
  toDate,
  openingBalance,
  rows,
  totalDebit,
  totalCredit,
  closingBalance,
  onClose,
}: LedgerStatementModalProps) {
  const dateRangeLabel =
    fromDate && toDate
      ? `${fromDate} to ${toDate}`
      : fromDate
        ? `From ${fromDate}`
        : toDate
          ? `Up to ${toDate}`
          : 'All Dates';

  const generatedDate = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/50 p-4 overflow-y-auto print:static print:inset-auto print:bg-transparent print:p-0"
      role="dialog"
      aria-modal="true"
      aria-labelledby="statement-title"
    >
      <div className="w-full max-w-4xl bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden my-6 print:my-0 print:border-0 print:shadow-none print:rounded-none">
        {/* Toolbar hidden when printing */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/70 print:hidden">
          <h2 id="statement-title" className="font-display text-base font-semibold text-[#0F2942]">
            Client Ledger Statement Preview
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0F2942] px-4 py-2 text-xs font-medium text-white hover:bg-[#163859] transition-colors cursor-pointer"
            >
              <Printer className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Print / Save as PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 cursor-pointer"
              aria-label="Close statement preview"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Printable Statement Body */}
        <div className="p-6 sm:p-10 space-y-6">
          {/* Office Header */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 border-b border-slate-200 pb-6">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center rounded-lg bg-[#0F2942] p-2 text-white">
                <Globe className="h-6 w-6" strokeWidth={1.85} aria-hidden="true" />
              </div>
              <div>
                <h1 className="font-display text-xl font-bold text-[#0F2942]">
                  Global Ties Office
                </h1>
                <p className="text-xs text-slate-500">Client Account Statement</p>
              </div>
            </div>

            <div className="text-xs text-slate-600 sm:text-right space-y-1">
              <div>
                Generated: <span className="font-mono text-slate-900">{generatedDate}</span>
              </div>
              <div>
                Period: <span className="font-mono text-slate-900">{dateRangeLabel}</span>
              </div>
            </div>
          </div>

          {/* Client Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 border border-slate-200 rounded-lg p-4">
            <div>
              <div className="text-xs text-slate-500">Client Name</div>
              <div className="mt-0.5 text-sm font-semibold text-slate-900">{clientName}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Mobile</div>
              <div className="mt-0.5 text-sm font-mono tabular-nums text-slate-900">
                {clientMobile || '—'}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Closing Balance</div>
              <div
                className={`mt-0.5 text-sm font-mono font-semibold tabular-nums ${
                  closingBalance > 0 ? 'text-red-700' : 'text-emerald-700'
                }`}
              >
                {formatPkr(closingBalance)}
              </div>
            </div>
          </div>

          {/* Statement Table */}
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-600">
                  <th className="px-4 py-2.5 whitespace-nowrap">Date</th>
                  <th className="px-4 py-2.5">Description</th>
                  <th className="px-4 py-2.5 text-right whitespace-nowrap">Debit</th>
                  <th className="px-4 py-2.5 text-right whitespace-nowrap">Credit</th>
                  <th className="px-4 py-2.5 text-right whitespace-nowrap">Running Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {fromDate && openingBalance !== 0 && (
                  <tr className="bg-slate-50/60">
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-500 whitespace-nowrap">
                      {fromDate}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600 italic">Opening Balance</td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-400">
                      —
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-400">
                      —
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums font-medium text-slate-900 whitespace-nowrap">
                      {formatPkr(openingBalance)}
                    </td>
                  </tr>
                )}

                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">
                      No ledger entries in the selected date range.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id}>
                      <td className="px-4 py-2.5 font-mono text-xs tabular-nums text-slate-700 whitespace-nowrap">
                        {row.date}
                      </td>
                      <td className="px-4 py-2.5 text-slate-900">
                        <div>{row.description}</div>
                        {(row.paymentMethod || row.referenceNo) && (
                          <div className="text-xs text-slate-500 mt-0.5">
                            {row.paymentMethod}
                            {row.referenceNo ? ` · Ref: ${row.referenceNo}` : ''}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-900 whitespace-nowrap">
                        {row.type === 'Debit' ? formatPkr(row.amount) : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums text-emerald-700 whitespace-nowrap">
                        {row.type === 'Credit' ? formatPkr(row.amount) : '—'}
                      </td>
                      <td
                        className={`px-4 py-2.5 text-right font-mono tabular-nums font-medium whitespace-nowrap ${
                          row.runningBalance > 0 ? 'text-red-700' : 'text-emerald-700'
                        }`}
                      >
                        {formatPkr(row.runningBalance)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold text-xs sm:text-sm">
                  <td colSpan={2} className="px-4 py-3 text-slate-900">
                    Totals &amp; Closing Balance
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-900 whitespace-nowrap">
                    {formatPkr(totalDebit)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-emerald-700 whitespace-nowrap">
                    {formatPkr(totalCredit)}
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-mono tabular-nums whitespace-nowrap ${
                      closingBalance > 0 ? 'text-red-700' : 'text-emerald-700'
                    }`}
                  >
                    {formatPkr(closingBalance)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
