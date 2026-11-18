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
  iconData?: string;
  iconUrl?: string;
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
 * Safely extracts the hostname from a URL (prepending https:// if missing).
 */
export function extractHostname(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';
  const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    return new URL(normalized).hostname;
  } catch {
    return '';
  }
}

/**
 * Builds the ordered list of icon candidate URLs for a website shortcut:
 * 1. Saved custom iconData (base64 PNG data URL) or iconUrl
 * 2. https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&url=https://<host>&size=128
 * 3. https://icons.duckduckgo.com/ip3/<host>.ico
 * 4. https://<host>/apple-touch-icon.png, then https://<host>/favicon.ico
 */
export function getIconCandidateUrls(
  rawUrl: string,
  customIconData?: string,
  customIconUrl?: string
): string[] {
  const candidates: string[] = [];

  const cleanData = (customIconData || '').trim();
  if (cleanData) {
    candidates.push(cleanData);
  }

  const cleanUrl = (customIconUrl || '').trim();
  if (cleanUrl) {
    candidates.push(cleanUrl);
  }

  const rawHost = extractHostname(rawUrl);
  const iconHost = rawHost.replace(/^www\./i, '');
  if (iconHost) {
    candidates.push(
      `https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&url=https://${encodeURIComponent(iconHost)}&size=128`
    );
    candidates.push(`https://icons.duckduckgo.com/ip3/${encodeURIComponent(iconHost)}.ico`);
    candidates.push(`https://${iconHost}/apple-touch-icon.png`);
    candidates.push(`https://${iconHost}/favicon.ico`);
  }

  return candidates;
}

/**
 * In-memory cache of resolved working icon URL (or null if all failed) per lookup key.
 */
export const resolvedIconCache = new Map<string, string | null>();

/**
 * Resizes an uploaded image file (PNG, JPG, SVG, ICO) to 128x128 on a canvas
 * while preserving aspect ratio on a transparent background, returning a PNG data URL.
 */
export function resizeIconToDataUrl(file: File, size = 128): Promise<string> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          reject(new Error('Canvas 2D context is not available.'));
          return;
        }

        const srcW = img.naturalWidth || img.width || size;
        const srcH = img.naturalHeight || img.height || size;
        const scale = Math.min(size / srcW, size / srcH);
        const drawW = Math.round(srcW * scale);
        const drawH = Math.round(srcH * scale);
        const offsetX = Math.round((size - drawW) / 2);
        const offsetY = Math.round((size - drawH) / 2);

        ctx.clearRect(0, 0, size, size);
        ctx.drawImage(img, offsetX, offsetY, drawW, drawH);

        const pngDataUrl = canvas.toDataURL('image/png');
        URL.revokeObjectURL(objectUrl);
        resolve(pngDataUrl);
      } catch (err) {
        URL.revokeObjectURL(objectUrl);
        reject(err);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Could not decode the selected image file.'));
    };

    img.src = objectUrl;
  });
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
