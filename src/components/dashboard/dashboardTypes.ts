import { ClientRecord } from '../clients/clientTypes';

export interface ClientTypeSlice {
  label: 'Business Registration' | 'Land Registry' | 'Student Visa' | 'Other';
  count: number;
  percentage: number;
  barColor: string;
  dotColor: string;
}

export interface ExpiryAlertItem {
  id: string;
  clientId: string;
  clientName: string;
  documentLabel: 'CNIC' | 'Passport';
  expiryDate: string;
  diffDays: number;
  level: 'expired' | 'soon';
  badgeText: string;
}

/**
 * Groups clients into the 4 office classification buckets for the Clients by Type chart.
 */
export function computeClientTypeBreakdown(clients: ClientRecord[]): ClientTypeSlice[] {
  const counts: Record<ClientTypeSlice['label'], number> = {
    'Business Registration': 0,
    'Land Registry': 0,
    'Student Visa': 0,
    Other: 0,
  };

  for (const client of clients) {
    const raw = (client.clientType || '').trim();
    if (raw === 'Business Registration') {
      counts['Business Registration'] += 1;
    } else if (raw === 'Land Registry') {
      counts['Land Registry'] += 1;
    } else if (raw === 'Student Visa') {
      counts['Student Visa'] += 1;
    } else {
      counts.Other += 1;
    }
  }

  const total = clients.length;
  const specs: {
    label: ClientTypeSlice['label'];
    barColor: string;
    dotColor: string;
  }[] = [
    {
      label: 'Business Registration',
      barColor: 'bg-[#0F172A]',
      dotColor: 'bg-[#0F172A]',
    },
    {
      label: 'Land Registry',
      barColor: 'bg-[#2563EB]',
      dotColor: 'bg-[#2563EB]',
    },
    {
      label: 'Student Visa',
      barColor: 'bg-blue-300',
      dotColor: 'bg-blue-400',
    },
    {
      label: 'Other',
      barColor: 'bg-slate-300',
      dotColor: 'bg-slate-400',
    },
  ];

  return specs.map((item) => {
    const count = counts[item.label];
    const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
    return {
      label: item.label,
      count,
      percentage,
      barColor: item.barColor,
      dotColor: item.dotColor,
    };
  });
}

function getDiffDaysFromToday(dateStr?: string): number | null {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return null;
  }
  const [year, month, day] = dateStr.split('-').map(Number);
  const expiry = new Date(year, month - 1, day);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Finds all CNIC and Passport expiry dates that have expired or expire within 60 days,
 * sorted from nearest/most overdue date first.
 */
export function computeExpiryAlerts(clients: ClientRecord[]): ExpiryAlertItem[] {
  const alerts: ExpiryAlertItem[] = [];

  for (const client of clients) {
    const checks: { docLabel: 'CNIC' | 'Passport'; dateStr?: string }[] = [
      { docLabel: 'CNIC', dateStr: client.cnicExpiryDate },
      { docLabel: 'Passport', dateStr: client.passportExpiryDate },
    ];

    for (const check of checks) {
      const diffDays = getDiffDaysFromToday(check.dateStr);
      if (diffDays === null || diffDays > 60 || !check.dateStr) continue;

      let level: 'expired' | 'soon' = 'soon';
      let badgeText = `Expiring in ${diffDays}d`;

      if (diffDays < 0) {
        level = 'expired';
        const overdue = Math.abs(diffDays);
        badgeText = overdue === 1 ? 'Expired 1d ago' : `Expired ${overdue}d ago`;
      } else if (diffDays === 0) {
        level = 'soon';
        badgeText = 'Expires today';
      }

      alerts.push({
        id: `${client.id}-${check.docLabel}`,
        clientId: client.id,
        clientName: client.name,
        documentLabel: check.docLabel,
        expiryDate: check.dateStr,
        diffDays,
        level,
        badgeText,
      });
    }
  }

  // Nearest date (most overdue / soonest expiring) first
  alerts.sort((a, b) => {
    if (a.diffDays !== b.diffDays) return a.diffDays - b.diffDays;
    return a.clientName.localeCompare(b.clientName);
  });

  return alerts;
}

/**
 * Formats an activityLog action key into a readable dashboard label.
 */
export function formatDashboardActionLabel(action: string): string {
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
    default:
      return action.replace(/_/g, ' ');
  }
}

/**
 * Formats a Firestore timestamp into a compact date/time label.
 */
export function formatTimestampCompact(ts?: { toDate?: () => Date } | null): string {
  if (!ts || typeof ts.toDate !== 'function') return 'Just now';
  return ts.toDate().toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
