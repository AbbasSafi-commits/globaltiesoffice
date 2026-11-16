import { Link } from 'react-router-dom';
import { ArrowUpRight, CreditCard } from 'lucide-react';
import { formatPkr, LedgerEntryRecord } from '../ledger/ledgerTypes';

interface RecentPaymentsCardProps {
  payments: LedgerEntryRecord[];
  loading: boolean;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

/**
 * Displays the last 10 Credit (payment received) ledger entries.
 * Rendered ONLY when the user has ledger view permission.
 */
export function RecentPaymentsCard({ payments, loading }: RecentPaymentsCardProps) {
  return (
    <section className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden flex flex-col">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Recent Payments</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Latest 10 credit receipts recorded in client ledgers
          </p>
        </div>
        <Link
          to="/ledger"
          className="text-xs font-medium text-[#2563EB] hover:text-[#1D4ED8] whitespace-nowrap"
        >
          Open ledger
        </Link>
      </div>

      {loading ? (
        <div className="p-6 space-y-3" aria-busy="true">
          {[1, 2, 3, 4].map((row) => (
            <div key={row} className="h-11 w-full rounded-lg bg-slate-100 animate-pulse" />
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
        <div className="overflow-auto max-h-96">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-xs border-b border-slate-200">
              <tr className="text-xs font-medium text-slate-500">
                <th className="px-6 py-3">Client</th>
                <th className="px-6 py-3">Method &amp; Date</th>
                <th className="px-6 py-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payments.map((entry) => {
                const clientName = entry.clientName || 'Client';
                return (
                  <tr key={entry.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-3.5">
                      <Link
                        to={`/clients/${entry.clientId}?tab=ledger`}
                        className="inline-flex items-center gap-2 font-medium text-slate-900 hover:text-[#2563EB] group"
                      >
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-semibold text-slate-600 group-hover:bg-blue-50 group-hover:text-[#2563EB]">
                          {getInitials(clientName)}
                        </span>
                        <span>{clientName}</span>
                        <ArrowUpRight className="h-3.5 w-3.5 text-slate-400 shrink-0 group-hover:text-[#2563EB]" aria-hidden="true" />
                      </Link>
                      <div className="mt-0.5 pl-8 text-xs text-slate-500 truncate max-w-[220px]">
                        {entry.description}
                      </div>
                    </td>
                    <td className="px-6 py-3.5 whitespace-nowrap">
                      <div className="text-xs font-medium text-slate-700">
                        {entry.paymentMethod}
                      </div>
                      <div className="text-xs font-mono tabular-nums text-slate-500">
                        {entry.date}
                      </div>
                    </td>
                    <td className="px-6 py-3.5 text-right font-mono text-xs font-semibold tabular-nums text-emerald-700 whitespace-nowrap">
                      {formatPkr(entry.amount)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
