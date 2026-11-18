import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';

export const PRESET_WEBSITE_CATEGORIES = [
  'Tax',
  'Business Registration',
  'Land Records',
  'Visa',
  'Banking',
  'Other',
] as const;

export interface WebsiteRecord {
  id: string;
  name: string;
  url: string;
  category: string;
  description?: string;
  sortOrder?: number;
  createdAt?: { toDate?: () => Date } | null;
  createdBy?: string;
  updatedAt?: { toDate?: () => Date } | null;
  updatedBy?: string;
}

/**
 * Validates that a URL starts with https:// and parses cleanly with a valid hostname.
 */
export function isValidHttpsUrl(rawUrl: string): boolean {
  const trimmed = rawUrl.trim();
  if (!trimmed.toLowerCase().startsWith('https://')) {
    return false;
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' && Boolean(parsed.hostname) && parsed.hostname.includes('.');
  } catch {
    return false;
  }
}

/**
 * Extracts the hostname from a URL for Google favicon lookup and display.
 */
export function extractHostname(rawUrl: string): string {
  try {
    return new URL(rawUrl).hostname;
  } catch {
    return '';
  }
}

/**
 * Returns the Google S2 favicon URL for a given website URL, or empty string if invalid.
 */
export function getFaviconUrl(rawUrl: string): string {
  const host = extractHostname(rawUrl);
  if (!host) return '';
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`;
}

/**
 * Records a Browse / Websites audit event in Firestore's activityLog collection.
 */
export async function logBrowseActivity(params: {
  userEmail: string;
  action: 'opened_website' | 'added_website' | 'updated_website' | 'deleted_website';
  websiteName: string;
  targetId?: string;
  details: string;
}): Promise<void> {
  await addDoc(collection(db, 'activityLog'), {
    userEmail: params.userEmail.toLowerCase(),
    action: params.action,
    module: 'browse',
    websiteName: params.websiteName,
    targetId: params.targetId || '',
    details: params.details,
    createdAt: serverTimestamp(),
  });
}
