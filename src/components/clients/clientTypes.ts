import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';

export type ClientStatus = 'Active' | 'Pending' | 'Completed' | 'On Hold';

export type CaseStatus =
  | 'Not Started'
  | 'In Progress'
  | 'Submitted'
  | 'Completed'
  | 'Rejected';

export const PRESET_CLIENT_TYPES = [
  'Business Registration',
  'Land Registry',
  'Student Visa',
] as const;

export const CLIENT_TYPE_DROPDOWN_OPTIONS = [
  ...PRESET_CLIENT_TYPES,
  'Other',
] as const;

export const CLIENT_STATUS_OPTIONS: ClientStatus[] = [
  'Active',
  'Pending',
  'Completed',
  'On Hold',
];

export const CASE_STATUS_OPTIONS: CaseStatus[] = [
  'Not Started',
  'In Progress',
  'Submitted',
  'Completed',
  'Rejected',
];

export const SUGGESTED_SERVICE_NAMES = [
  'Company Registration',
  'Land Registry Transfer',
  'Student Visa',
  'NTN Registration',
  'Tax Return Filing',
  'Trademark Registration',
] as const;

export interface ClientRecord {
  id: string;
  name: string;
  nameLower: string;
  fatherName: string;
  mobile: string;
  email: string;
  address: string;
  cnic: string;
  cnicIssueDate: string;
  cnicExpiryDate: string;
  passportNumber: string;
  passportIssueDate: string;
  passportExpiryDate: string;
  ntn: string;
  incNo?: string;
  taxYear?: string;
  incDate?: string;
  registrationDate?: string;
  taxFilingDate?: string;
  photoData?: string;
  clientType: string;
  status: ClientStatus;
  notes: string;
  createdAt?: { toDate?: () => Date } | null;
  createdBy?: string;
  updatedAt?: { toDate?: () => Date } | null;
  updatedBy?: string;
}

export interface BusinessDetailsRecord {
  clientId: string;
  businessName: string;
  businessCategory: string;
  incNo: string;
  ntn?: string;
  notes: string;
  createdAt?: { toDate?: () => Date } | null;
  createdBy?: string;
  updatedAt?: { toDate?: () => Date } | null;
  updatedBy?: string;
}

export interface CaseRecord {
  id: string;
  clientId: string;
  department?: string;
  subCategory?: string;
  serviceName?: string;
  status: CaseStatus;
  startDate: string;
  expectedDate: string;
  completedDate: string;
  fees: number | null;
  notes: string;
  createdAt?: { toDate?: () => Date } | null;
  createdBy?: string;
  updatedAt?: { toDate?: () => Date } | null;
  updatedBy?: string;
}

export interface ServiceDepartmentRecord {
  id: string;
  name: string;
  subCategories: string[];
  sortOrder: number;
}

export const DEFAULT_SERVICE_DEPARTMENTS = [
  'FBR',
  'SECP',
  'Excise & Taxation',
  'Sindh Revenue Board',
  'Land Registry',
  'Visa',
  'Other',
] as const;

export const CNIC_REGEX = /^\d{5}-\d{7}-\d$/;

/**
 * Auto-formats raw digits into 00000-0000000-0 CNIC structure as the user types.
 */
export function formatCnicInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 13);
  if (digits.length <= 5) return digits;
  if (digits.length <= 12) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
}

/**
 * Formats a Firestore timestamp into a readable date string.
 */
export function formatClientDate(ts?: { toDate?: () => Date } | null): string {
  if (!ts || typeof ts.toDate !== 'function') return 'Just now';
  return ts.toDate().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Checks whether a YYYY-MM-DD expiry date is already expired or expiring within 60 days.
 */
export function getExpiryWarning(dateStr?: string): {
  level: 'expired' | 'soon' | null;
  label: string;
} {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return { level: null, label: '' };
  }

  const [year, month, day] = dateStr.split('-').map(Number);
  const expiry = new Date(year, month - 1, day);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const diffMs = expiry.getTime() - today.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { level: 'expired', label: 'Expired' };
  }
  if (diffDays === 0) {
    return { level: 'soon', label: 'Expires today' };
  }
  if (diffDays <= 60) {
    return { level: 'soon', label: `Expiring in ${diffDays}d` };
  }
  return { level: null, label: '' };
}

/**
 * Logs a client, business details, or case service event into Firestore's activityLog collection.
 */
export async function logClientActivity(params: {
  userEmail: string;
  action:
    | 'added_client'
    | 'updated_client'
    | 'deleted_client'
    | 'added_business_details'
    | 'updated_business_details'
    | 'added_case'
    | 'updated_case'
    | 'deleted_case';
  module?: 'clients' | 'business_details';
  targetId: string;
  details: string;
}): Promise<void> {
  try {
    await addDoc(collection(db, 'activityLog'), {
      userEmail: params.userEmail.toLowerCase(),
      action: params.action,
      module: params.module ?? 'clients',
      targetId: params.targetId,
      details: params.details,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, 'activityLog');
  }
}

const MAX_PHOTO_DATA_BYTES = 60 * 1024;
const PHOTO_TARGET_SIZE = 256;

/**
 * Validates a JPG/PNG file, center-crops it to a square, resizes to 256x256
 * using an HTML5 canvas, and returns a JPEG data URL under 60 KB.
 */
export async function processClientPhoto(file: File): Promise<string> {
  const mime = (file.type || '').toLowerCase();
  const lowerName = file.name.toLowerCase();
  const isAllowed =
    mime === 'image/jpeg' ||
    mime === 'image/jpg' ||
    mime === 'image/png' ||
    lowerName.endsWith('.jpg') ||
    lowerName.endsWith('.jpeg') ||
    lowerName.endsWith('.png');

  if (!isAllowed) {
    throw new Error('Please upload a JPG or PNG image for the profile photo.');
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Unable to read the selected image file.'));
      el.src = objectUrl;
    });

    const srcW = img.naturalWidth || img.width;
    const srcH = img.naturalHeight || img.height;
    const side = Math.min(srcW, srcH);
    const sx = Math.floor((srcW - side) / 2);
    const sy = Math.floor((srcH - side) / 2);

    const canvas = document.createElement('canvas');
    canvas.width = PHOTO_TARGET_SIZE;
    canvas.height = PHOTO_TARGET_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Browser canvas is unavailable.');
    }

    // White background so transparent PNGs encode cleanly as JPEG
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, PHOTO_TARGET_SIZE, PHOTO_TARGET_SIZE);
    ctx.drawImage(img, sx, sy, side, side, 0, 0, PHOTO_TARGET_SIZE, PHOTO_TARGET_SIZE);

    // Start at quality 0.8 and step down only if needed to stay under 60 KB
    let quality = 0.8;
    let dataUrl = canvas.toDataURL('image/jpeg', quality);
    while (dataUrl.length > MAX_PHOTO_DATA_BYTES && quality > 0.35) {
      quality = Math.max(0.35, Number((quality - 0.1).toFixed(2)));
      dataUrl = canvas.toDataURL('image/jpeg', quality);
    }

    if (dataUrl.length > MAX_PHOTO_DATA_BYTES) {
      throw new Error('Compressed photo is still over 60 KB. Please choose a simpler image.');
    }

    return dataUrl;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

