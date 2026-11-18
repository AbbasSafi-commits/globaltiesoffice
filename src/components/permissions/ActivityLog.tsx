import { useEffect, useState } from 'react';
import { History } from 'lucide-react';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';

export interface ActivityLogRecord {
  id: string;
  userEmail: string;
  action: string;
  module: string;
  targetEmail?: string;
  targetId?: string;
  clientId?: string;
  websiteName?: string;
  details: string;
  createdAt?: { toDate?: () => Date } | null;
}

function formatActionLabel(action: string): string {
  switch (action) {
    case 'invited_user':
      return 'Invited user';
    case 'updated_permissions':
      return 'Updated permissions';
    case 'disabled_user':
      return 'Disabled user';
    case 'enabled_user':
      return 'Enabled user';
    case 'deleted_user':
      return 'Deleted user';
    case 'added_client':
      return 'Added client';
    case 'updated_client':
      return 'Updated client';
    case 'deleted_client':
      return 'Deleted client';
    case 'added_business_details':
      return 'Added business details';
    case 'updated_business_details':
      return 'Updated business details';
    case 'added_case':
      return 'Added service';
    case 'updated_case':
      return 'Updated service';
    case 'deleted_case':
      return 'Deleted service';
    case 'added_portal_login':
      return 'Added portal login';
    case 'updated_portal_login':
      return 'Updated portal login';
    case 'deleted_portal_login':
      return 'Deleted portal login';
    case 'revealed_password':
      return 'Revealed credential';
    case 'copied_password':
      return 'Copied credential';
    case 'added_ledger_entry':
      return 'Added ledger entry';
    case 'updated_ledger_entry':
      return 'Updated ledger entry';
    case 'deleted_ledger_entry':
      return 'Deleted ledger entry';
    case 'uploaded_document':
      return 'Uploaded document';
    case 'viewed_document':
      return 'Viewed document';
    case 'downloaded_document':
      return 'Downloaded document';
    case 'deleted_document':
      return 'Deleted document';
    case 'opened_website':
      return 'Opened website';
    case 'added_website':
      return 'Added website';
    case 'updated_website':
      return 'Updated website';
    case 'deleted_website':
      return 'Deleted website';
    default:
      return action.replace(/_/g, ' ');
  }
}

function formatTimestamp(ts?: { toDate?: () => Date } | null): string {
  if (!ts || typeof ts.toDate !== 'function') {
    return 'Just now';
  }
  const date = ts.toDate();
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Displays the latest 50 audit events from Firestore's activityLog collection.
 */
export function ActivityLog() {
  const [entries, setEntries] = useState<ActivityLogRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const logQuery = query(
      collection(db, 'activityLog'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(
      logQuery,
      (snapshot) => {
        const items: ActivityLogRecord[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<ActivityLogRecord, 'id'>),
        }));
        setEntries(items);
        setError(null);
        setLoading(false);
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.LIST, 'activityLog');
        } catch {
          setError('Unable to load activity log. Please check your permissions.');
          setLoading(false);
        }
      }
    );

    return () => unsubscribe();
  }, []);

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Recent Activity Log
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Showing the latest 50 permission and staff management events, newest first.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="p-6 space-y-3" aria-busy="true" aria-label="Loading activity log">
          {[1, 2, 3, 4].map((row) => (
            <div key={row} className="h-11 w-full rounded-lg bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="px-6 py-10 text-center text-sm text-red-700">{error}</div>
      ) : entries.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
            <History className="h-5 w-5" aria-hidden="true" />
          </div>
          <p className="text-sm font-medium text-slate-900">No activity recorded yet</p>
          <p className="mt-1 text-sm text-slate-500">
            Invites, permission changes, status updates, and removals will appear here.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto max-h-[68vh] overflow-y-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 z-10 bg-table-head">
              <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                <th className="px-6 py-3">Time</th>
                <th className="px-6 py-3">Who</th>
                <th className="px-6 py-3">Action</th>
                <th className="px-6 py-3">Target</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {entries.map((entry) => (
                <tr key={entry.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-6 py-3.5 text-xs font-mono tabular-nums text-slate-500 whitespace-nowrap">
                    {formatTimestamp(entry.createdAt)}
                  </td>
                  <td className="px-6 py-3.5 font-mono text-xs text-slate-800 whitespace-nowrap">
                    {entry.userEmail}
                  </td>
                  <td className="px-6 py-3.5">
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                      {formatActionLabel(entry.action)}
                    </span>
                    {entry.details && (
                      <div className="text-xs text-slate-500 mt-1">{entry.details}</div>
                    )}
                  </td>
                  <td className="px-6 py-3.5 font-mono text-xs text-slate-600 whitespace-nowrap">
                    {entry.targetEmail || entry.targetId || entry.clientId || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
