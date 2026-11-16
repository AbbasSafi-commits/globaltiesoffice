import { ActionKey, ModuleKey, ModulePermissions } from '../../context/AuthContext';

export type RolePresetKey =
  | 'manager'
  | 'accountant'
  | 'data_entry'
  | 'custom'
  | 'super_admin';

export type FullPermissionsGrid = Record<ModuleKey, ModulePermissions>;

export const OWNER_EMAIL = 'myn91509@gmail.com';

export const MODULES: { key: ModuleKey; label: string }[] = [
  { key: 'clients', label: 'Clients' },
  { key: 'business_details', label: 'Business Details' },
  { key: 'portal_logins', label: 'Portal Logins (IDs & Passwords)' },
  { key: 'ledger', label: 'Ledger' },
  { key: 'documents', label: 'Documents / Files' },
];

export const ACTIONS: { key: ActionKey; label: string }[] = [
  { key: 'view', label: 'View' },
  { key: 'add', label: 'Add' },
  { key: 'edit', label: 'Edit' },
  { key: 'delete', label: 'Delete' },
];

export const ROLE_OPTIONS: { value: RolePresetKey; label: string }[] = [
  { value: 'manager', label: 'Manager' },
  { value: 'accountant', label: 'Accountant' },
  { value: 'data_entry', label: 'Data Entry' },
  { value: 'custom', label: 'Custom' },
  { value: 'super_admin', label: 'Super Admin' },
];

export function createEmptyPermissions(): FullPermissionsGrid {
  return {
    clients: { view: false, add: false, edit: false, delete: false },
    business_details: { view: false, add: false, edit: false, delete: false },
    portal_logins: { view: false, add: false, edit: false, delete: false },
    ledger: { view: false, add: false, edit: false, delete: false },
    documents: { view: false, add: false, edit: false, delete: false },
  };
}

export function createFullPermissions(): FullPermissionsGrid {
  return {
    clients: { view: true, add: true, edit: true, delete: true },
    business_details: { view: true, add: true, edit: true, delete: true },
    portal_logins: { view: true, add: true, edit: true, delete: true },
    ledger: { view: true, add: true, edit: true, delete: true },
    documents: { view: true, add: true, edit: true, delete: true },
  };
}

/**
 * Returns a fresh permission map matching one of the predefined role presets.
 */
export function getPresetPermissions(role: RolePresetKey): FullPermissionsGrid {
  switch (role) {
    case 'manager':
      return {
        clients: { view: true, add: true, edit: true, delete: false },
        business_details: { view: true, add: true, edit: true, delete: false },
        portal_logins: { view: true, add: false, edit: false, delete: false },
        ledger: { view: true, add: true, edit: true, delete: false },
        documents: { view: true, add: true, edit: true, delete: false },
      };
    case 'accountant':
      return {
        clients: { view: true, add: false, edit: false, delete: false },
        business_details: { view: false, add: false, edit: false, delete: false },
        portal_logins: { view: false, add: false, edit: false, delete: false },
        ledger: { view: true, add: true, edit: true, delete: false },
        documents: { view: false, add: false, edit: false, delete: false },
      };
    case 'data_entry':
      return {
        clients: { view: true, add: true, edit: false, delete: false },
        business_details: { view: true, add: true, edit: false, delete: false },
        portal_logins: { view: false, add: false, edit: false, delete: false },
        ledger: { view: false, add: false, edit: false, delete: false },
        documents: { view: true, add: true, edit: false, delete: false },
      };
    case 'super_admin':
      return createFullPermissions();
    case 'custom':
    default:
      return createEmptyPermissions();
  }
}

/**
 * Normalizes partial or missing Firestore permission maps into a complete 5x4 grid.
 */
export function normalizePermissions(
  raw?: Partial<Record<ModuleKey, Partial<ModulePermissions>>>
): FullPermissionsGrid {
  const base = createEmptyPermissions();
  if (!raw) return base;

  for (const mod of MODULES) {
    const entry = raw[mod.key];
    if (entry) {
      const add = Boolean(entry.add);
      const edit = Boolean(entry.edit);
      const del = Boolean(entry.delete);
      const view = Boolean(entry.view) || add || edit || del;
      base[mod.key] = { view, add, edit, delete: del };
    }
  }
  return base;
}

export function formatRoleName(role?: string): string {
  switch (role) {
    case 'super_admin':
      return 'Super Admin';
    case 'manager':
      return 'Manager';
    case 'accountant':
      return 'Accountant';
    case 'data_entry':
      return 'Data Entry';
    case 'custom':
      return 'Custom';
    case 'admin':
      return 'Admin';
    case 'staff':
      return 'Staff';
    default:
      return role || 'Custom';
  }
}
