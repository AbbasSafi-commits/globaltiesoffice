import { Link } from 'react-router-dom';
import { ArrowUpRight, CreditCard } from 'lucide-react';
import { formatPkr, LedgerEntryRecord } from '../ledger/ledgerTypes';

interface RecentPaymentsCardProps {
  payments: LedgerEntryRecord[];
  loading: boolean;
}

/**
 * Displays the last 10 Credit (payment received) ledger entries.
 * Rendered ONLY when the user has ledger view permission.
 */
export function RecentPaymentsCard({ payments, loading }: RecentPaymentsCardProps) {
  return (
    <section className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
      <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-sm font-semibold text-[#0F2942]">
            Recent Payments
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Latest 10 credit receipts recorded in client ledgers
          </p>
        </div>
        <Link
          to="/ledger"
          className="text-xs font-medium text-[#1D4ED8] hover:text-[#0F2942] whitespace-nowrap"
        >
          Open ledger
        </Link>
      </div>

      {loading ? (
        <div className="p-6 space-y-3" aria-busy="true">
          {[1, 2, 3, 4].map((row) => (
            <div key={row} className="h-11 w-full rounded-md bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : payments.length === 0 ? (
        <div className="px-6 py-12 text-center flex-1 flex flex-col items-center justify-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500">
            <CreditCard className="h-5 w-5" aria-hidden="true" />
          </div>
          <p className="mt-3 text-sm font-medium text-slate-900">
            No payments recorded yet
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Client credit entries will appear here as payments are logged.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-medium text-slate-500">
                <th className="px-6 py-3">Client</th>
                <th className="px-6 py-3">Method & Date</th>
                <th className="px-6 py-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {payments.map((entry) => (
                <tr key={entry.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-6 py-3">
                    <Link
                      to={`/clients/${entry.clientId}?tab=ledger`}
                      className="inline-flex items-center gap-1 font-medium text-slate-900 hover:text-[#1D4ED8] hover:underline"
                    >
                      <span>{entry.clientName || 'Client'}</span>
                      <ArrowUpRight className="h-3.5 w-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                    </Link>
                    <div className="text-xs text-slate-500 truncate max-w-[220px]">
                      {entry.description}
                    </div>
                  </td>
                  <td className="px-6 py-3 whitespace-nowrap">
                    <div className="text-xs font-medium text-slate-700">
                      {entry.paymentMethod}
                    </div>
                    <div className="text-xs font-mono tabular-nums text-slate-500">
                      {entry.date}
                    </div>
                  </td>
                  <td className="px-6 py-3 text-right font-mono text-xs font-semibold tabular-nums text-emerald-700 whitespace-nowrap">
                    {formatPkr(entry.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
