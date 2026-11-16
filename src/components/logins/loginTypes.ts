import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';

export const SUGGESTED_PORTAL_NAMES = [
  'FBR',
  'SECP',
  'Excise & Taxation',
  'Sindh Revenue Board',
  'Land Registry',
  'Visa Portal',
] as const;

export interface PortalLoginRecord {
  id: string;
  clientId: string;
  departmentName: string;
  websiteUrl: string;
  loginId: string;
  password: string;
  pinCode: string;
  notes: string;
  createdAt?: { toDate?: () => Date } | null;
  createdBy?: string;
  updatedAt?: { toDate?: () => Date } | null;
  updatedBy?: string;
}

/**
 * Ensures external portal links use a safe http/https scheme before rendering.
 */
export function normalizeSafeUrl(rawUrl?: string): string {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
    // Reject unsafe schemes such as javascript: or data:
    return '';
  }
  return `https://${trimmed}`;
}

/**
 * Logs portal login actions (add/edit/delete/reveal/copy) to Firestore activityLog.
 * Never logs actual password or PIN values.
 */
export async function logPortalLoginActivity(params: {
  userEmail: string;
  action:
    | 'added_portal_login'
    | 'updated_portal_login'
    | 'deleted_portal_login'
    | 'revealed_password'
    | 'copied_password';
  clientId: string;
  websiteName: string;
  targetId?: string;
  details: string;
}): Promise<void> {
  try {
    await addDoc(collection(db, 'activityLog'), {
      userEmail: params.userEmail.toLowerCase(),
      action: params.action,
      module: 'portal_logins',
      clientId: params.clientId,
      websiteName: params.websiteName,
      ...(params.targetId ? { targetId: params.targetId } : {}),
      details: params.details,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, 'activityLog');
  }
}
