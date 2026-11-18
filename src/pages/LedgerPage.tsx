import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowUpRight, Search, X } from 'lucide-react';
import { collection, onSnapshot } from 'firebase/firestore';
import { ClientRecord } from '../components/clients/clientTypes';
import { formatPkr, LedgerEntryRecord } from '../components/ledger/ledgerTypes';
import { useAuth } from '../context/AuthContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';

interface ClientLedgerSummary {
  clientId: string;
  clientName: string;
  mobile: string;
  clientType: string;
  totalDebit: number;
  totalCredit: number;
  balance: number;
  entryCount: number;
}

/**
 * Main Ledger overview page (/ledger) grouping all Firestore ledger entries by client,
 * sorted by highest balance due descending.
 */
export function LedgerPage() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const canViewClients = can('clients', 'view');

  const [entries, setEntries] = useState<LedgerEntryRecord[]>([]);
  const [clientsMap, setClientsMap] = useState<Record<string, ClientRecord>>({});
  const [loadingLedger, setLoadingLedger] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Subscribe to all ledger entries
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'ledger'),
      (snapshot) => {
        const list: LedgerEntryRecord[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<LedgerEntryRecord, 'id'>),
        }));
        setEntries(list);
        setLoadingLedger(false);
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.LIST, 'ledger');
        } catch {
          setErrorMsg('Unable to load ledger entries. Please check your permissions.');
          setLoadingLedger(false);
        }
      }
    );

    return () => unsubscribe();
  }, []);

  // Optionally enrich with client details if user also has clients view permission
  useEffect(() => {
    if (!canViewClients) return;

    const unsubscribe = onSnapshot(
      collection(db, 'clients'),
      (snapshot) => {
        const map: Record<string, ClientRecord> = {};
        for (const docSnap of snapshot.docs) {
          map[docSnap.id] = {
            id: docSnap.id,
            ...(docSnap.data() as Omit<ClientRecord, 'id'>),
          };
        }
        setClientsMap(map);
      },
      () => {
        // Non-fatal: ledger entries already carry clientName
      }
    );

    return () => unsubscribe();
  }, [canViewClients]);

  // Group ledger entries by clientId and merge with known clients
  const summaries = useMemo(() => {
    const grouped: Record<string, ClientLedgerSummary> = {};

    // Seed with known clients first so clients with zero entries also appear cleanly
    for (const [id, client] of Object.entries(clientsMap)) {
      grouped[id] = {
        clientId: id,
        clientName: client.name,
        mobile: client.mobile || '',
        clientType: client.clientType || '',
        totalDebit: 0,
        totalCredit: 0,
        balance: 0,
        entryCount: 0,
      };
    }

    for (const entry of entries) {
      const cid = entry.clientId;
      if (!cid) continue;

      if (!grouped[cid]) {
        const clientInfo = clientsMap[cid];
        grouped[cid] = {
          clientId: cid,
          clientName: clientInfo?.name || entry.clientName || 'Unknown Client',
          mobile: clientInfo?.mobile || '',
          clientType: clientInfo?.clientType || '',
          totalDebit: 0,
          totalCredit: 0,
          balance: 0,
          entryCount: 0,
        };
      }

      const amount = Number(entry.amount) || 0;
      if (entry.type === 'Debit') {
        grouped[cid].totalDebit += amount;
      } else {
        grouped[cid].totalCredit += amount;
      }
      grouped[cid].entryCount += 1;
      grouped[cid].balance = grouped[cid].totalDebit - grouped[cid].totalCredit;
    }

    const list = Object.values(grouped);
    // Sort by highest balance due descending, then by client name
    list.sort((a, b) => {
      if (b.balance !== a.balance) return b.balance - a.balance;
      return a.clientName.localeCompare(b.clientName);
    });
    return list;
  }, [entries, clientsMap]);

  const officeTotals = useMemo(() => {
    return summaries.reduce(
      (acc, row) => {
        acc.debit += row.totalDebit;
        acc.credit += row.totalCredit;
        acc.balance += row.balance;
        return acc;
      },
      { debit: 0, credit: 0, balance: 0 }
    );
  }, [summaries]);

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredSummaries = summaries.filter((row) => {
    if (!normalizedQuery) return true;
    return (
      row.clientName.toLowerCase().includes(normalizedQuery) ||
      row.mobile.toLowerCase().includes(normalizedQuery) ||
      row.clientType.toLowerCase().includes(normalizedQuery)
    );
  });

  const getInitials = (name: string): string => {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Ledger</h1>
        <p className="mt-1 text-sm text-slate-500">
          Client balances across Global Ties, sorted by highest balance due. Click any client to open their ledger.
        </p>
      </div>

      {errorMsg && (
        <div
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 flex items-center justify-between gap-3"
          role="alert"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
            <span>{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="text-red-700 hover:text-red-900 cursor-pointer"
            aria-label="Dismiss error"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Office-wide Totals */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="text-xs font-medium text-slate-500">Total Billed (Debit)</div>
          <div className="mt-2 font-mono text-2xl font-semibold tabular-nums text-slate-900">
            {formatPkr(officeTotals.debit)}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="text-xs font-medium text-slate-500">Total Collected (Credit)</div>
          <div className="mt-2 font-mono text-2xl font-semibold tabular-nums text-emerald-700">
            {formatPkr(officeTotals.credit)}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="text-xs font-medium text-slate-500">Net Balance Due</div>
          <div
            className={`mt-2 font-mono text-2xl font-semibold tabular-nums ${
              officeTotals.balance > 0 ? 'text-red-600' : 'text-emerald-700'
            }`}
          >
            {formatPkr(officeTotals.balance)}
          </div>
        </div>
      </div>

      {/* Client Balances Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="p-4 sm:px-6 sm:py-4 border-b border-slate-100 flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search
              className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search client name, mobile, or type..."
              aria-label="Search client ledgers"
              className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>

        {loadingLedger ? (
          <div className="p-6 space-y-3" aria-busy="true">
            {[1, 2, 3, 4].map((row) => (
              <div key={row} className="h-11 w-full rounded-lg bg-slate-100 animate-pulse" />
            ))}
          </div>
        ) : summaries.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-500">
              <Search className="h-5 w-5" aria-hidden="true" />
            </div>
            <p className="text-sm font-medium text-slate-900">No ledger records found</p>
            <p className="mt-1 text-sm text-slate-500">
              Open a client profile and add a ledger entry to track debits, credits, and balances.
            </p>
          </div>
        ) : filteredSummaries.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-500">
              <Search className="h-5 w-5" aria-hidden="true" />
            </div>
            <p className="text-sm font-medium text-slate-900">No matching clients found</p>
            <p className="mt-1 text-sm text-slate-500">Try adjusting your search query.</p>
          </div>
        ) : (
          <div className="overflow-auto max-h-[640px]">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 z-10 bg-table-head border-b border-border">
                <tr className="text-xs font-medium text-slate-500">
                  <th className="px-6 py-3.5">Client</th>
                  <th className="px-6 py-3.5 text-right whitespace-nowrap">Total Debit</th>
                  <th className="px-6 py-3.5 text-right whitespace-nowrap">Total Credit</th>
                  <th className="px-6 py-3.5 text-right whitespace-nowrap">Balance</th>
                  <th className="px-6 py-3.5 text-right whitespace-nowrap">Open</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSummaries.map((row) => {
                  const owesMoney = row.balance > 0;
                  return (
                    <tr
                      key={row.clientId}
                      onClick={() => navigate(`/clients/${row.clientId}?tab=ledger`)}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                    >
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-3">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600 group-hover:bg-blue-50 group-hover:text-primary">
                            {getInitials(row.clientName)}
                          </span>
                          <div>
                            <div className="font-medium text-slate-900 group-hover:text-primary transition-colors">
                              {row.clientName}
                            </div>
                            {(row.mobile || row.clientType) && (
                              <div className="text-xs text-slate-500 mt-0.5 flex flex-wrap items-center gap-1.5">
                                {row.clientType && (
                                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                                    {row.clientType}
                                  </span>
                                )}
                                {row.mobile && (
                                  <span className="font-mono tabular-nums">{row.mobile}</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-3.5 text-right font-mono text-xs tabular-nums text-slate-900 whitespace-nowrap">
                        {formatPkr(row.totalDebit)}
                      </td>
                      <td className="px-6 py-3.5 text-right font-mono text-xs tabular-nums text-emerald-700 whitespace-nowrap">
                        {formatPkr(row.totalCredit)}
                      </td>
                      <td
                        className={`px-6 py-3.5 text-right font-mono text-xs font-semibold tabular-nums whitespace-nowrap ${
                          owesMoney ? 'text-red-600' : 'text-emerald-700'
                        }`}
                      >
                        {formatPkr(row.balance)}
                      </td>
                      <td className="px-6 py-3.5 text-right whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                          <span>Ledger</span>
                          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
