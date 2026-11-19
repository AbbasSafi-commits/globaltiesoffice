import {
  collection,
  documentId,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { ClientRecord } from './clientTypes';

export type CompletenessModuleKey =
  | 'details'
  | 'business'
  | 'documents'
  | 'logins'
  | 'services'
  | 'ledger';

export type MissingFilterKey =
  | 'all'
  | 'logins'
  | 'business'
  | 'documents'
  | 'services'
  | 'ledger';

export interface ClientCompletenessFlags {
  business: boolean;
  documents: boolean;
  logins: boolean;
  services: boolean;
  ledger: boolean;
}

export type ClientCompletenessMap = Record<string, ClientCompletenessFlags>;

export interface CompletenessPermissions {
  canViewBusiness: boolean;
  canViewDocuments: boolean;
  canViewLogins: boolean;
  canViewLedger: boolean;
}

const EMPTY_FLAGS: ClientCompletenessFlags = {
  business: false,
  documents: false,
  logins: false,
  services: false,
  ledger: false,
};

/**
 * Returns true if the client's Details section is considered complete (CNIC or mobile exists).
 */
export function hasClientDetails(client: ClientRecord): boolean {
  return Boolean((client.cnic || '').trim() || (client.mobile || '').trim());
}

/**
 * Splits an array of IDs into Firestore-safe `in` query chunks of max 10 items.
 */
function chunkIds(ids: string[], size = 10): string[][] {
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += size) {
    chunks.push(ids.slice(i, i + size));
  }
  return chunks;
}

/**
 * Efficiently fetches completeness flags for only the given page of client IDs,
 * querying each permitted collection in batches of 10 with `clientId in [...]`.
 */
export async function fetchClientCompletenessForIds(
  clientIds: string[],
  perms: CompletenessPermissions
): Promise<ClientCompletenessMap> {
  const result: ClientCompletenessMap = {};
  clientIds.forEach((id) => {
    result[id] = { ...EMPTY_FLAGS };
  });

  if (clientIds.length === 0) return result;

  const batches = chunkIds(clientIds, 10);

  const runClientIdCollection = async (
    collectionName: string,
    flagKey: keyof ClientCompletenessFlags
  ) => {
    await Promise.all(
      batches.map(async (batch) => {
        try {
          const snap = await getDocs(
            query(collection(db, collectionName), where('clientId', 'in', batch))
          );
          snap.forEach((docSnap) => {
            const cid = (docSnap.data() as { clientId?: string }).clientId;
            if (cid && result[cid]) {
              result[cid][flagKey] = true;
            }
          });
        } catch {
          // Ignore individual permission errors so other chips still render
        }
      })
    );
  };

  const runBusinessDetails = async () => {
    await Promise.all(
      batches.map(async (batch) => {
        try {
          const snap = await getDocs(
            query(collection(db, 'businessDetails'), where(documentId(), 'in', batch))
          );
          snap.forEach((docSnap) => {
            if (result[docSnap.id]) {
              result[docSnap.id].business = true;
            }
          });
        } catch {
          // Ignore if user lacks business_details permission
        }
      })
    );
  };

  const tasks: Promise<void>[] = [runClientIdCollection('cases', 'services')];
  if (perms.canViewBusiness) tasks.push(runBusinessDetails());
  if (perms.canViewDocuments) tasks.push(runClientIdCollection('documents', 'documents'));
  if (perms.canViewLogins) tasks.push(runClientIdCollection('portalLogins', 'logins'));
  if (perms.canViewLedger) tasks.push(runClientIdCollection('ledger', 'ledger'));

  await Promise.all(tasks);
  return result;
}
