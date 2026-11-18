import { Lock, Pencil, Search, Trash2, UserCheck, UserPlus, UserX } from 'lucide-react';
import { StaffProfile } from '../../context/AuthContext';
import { formatRoleName, OWNER_EMAIL } from './permissionPresets';

interface UserTableProps {
  users: StaffProfile[];
  loading: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  currentUserEmail: string;
  onInviteClick: () => void;
  onEditClick: (user: StaffProfile) => void;
  onToggleActiveClick: (user: StaffProfile) => void;
  onDeleteClick: (user: StaffProfile) => void;
}

function getStaffInitials(name?: string, email?: string): string {
  const source = (name || email || '').trim();
  if (!source) return 'U';
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

/**
 * Displays all staff profiles from Firestore with search filtering,
 * owner/self lock protection, and administrative actions.
 */
export function UserTable({
  users,
  loading,
  searchQuery,
  onSearchChange,
  currentUserEmail,
  onInviteClick,
  onEditClick,
  onToggleActiveClick,
  onDeleteClick,
}: UserTableProps) {
  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredUsers = users.filter((staff) => {
    if (!normalizedQuery) return true;
    const nameMatch = (staff.fullName || '').toLowerCase().includes(normalizedQuery);
    const emailMatch = (staff.email || '').toLowerCase().includes(normalizedQuery);
    return nameMatch || emailMatch;
  });

  const isLockedAccount = (email: string) => {
    const normalized = email.toLowerCase();
    return normalized === OWNER_EMAIL || normalized === currentUserEmail.toLowerCase();
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
      {/* Toolbar: Search + Invite User */}
      <div className="p-4 sm:px-6 sm:py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search
            className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by name or Gmail..."
            aria-label="Search staff by name or Gmail"
            className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <button
          type="button"
          onClick={onInviteClick}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary cursor-pointer"
        >
          <UserPlus className="h-4 w-4" aria-hidden="true" />
          <span>Invite User</span>
        </button>
      </div>

      {/* Table States */}
      {loading ? (
        <div className="p-6 space-y-3" aria-busy="true" aria-label="Loading users">
          {[1, 2, 3].map((row) => (
            <div
              key={row}
              className="h-12 w-full rounded-lg bg-slate-100 animate-pulse"
            />
          ))}
        </div>
      ) : users.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
            <UserPlus className="h-5 w-5" aria-hidden="true" />
          </div>
          <p className="text-sm font-medium text-slate-900">No users invited yet</p>
          <p className="mt-1 text-sm text-slate-500">
            Click &ldquo;Invite User&rdquo; to grant a staff member access to Global Ties.
          </p>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
            <Search className="h-5 w-5" aria-hidden="true" />
          </div>
          <p className="text-sm font-medium text-slate-900">No matching staff members</p>
          <p className="mt-1 text-sm text-slate-500">
            Try clearing or adjusting your search filter.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto max-h-[68vh] overflow-y-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 z-10 bg-table-head">
              <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                <th className="px-6 py-3">Name</th>
                <th className="px-6 py-3">Gmail</th>
                <th className="px-6 py-3">Role</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.map((staff) => {
                const locked = isLockedAccount(staff.email);
                const active = staff.isActive === true;
                const isSuper = staff.role === 'super_admin';

                return (
                  <tr key={staff.email} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-3.5 font-medium text-slate-900 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <span
                          aria-hidden="true"
                          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700"
                        >
                          {getStaffInitials(staff.fullName, staff.email)}
                        </span>
                        <span>{staff.fullName}</span>
                      </div>
                    </td>

                    <td className="px-6 py-3.5 font-mono text-xs text-slate-600 whitespace-nowrap">
                      {staff.email}
                    </td>

                    <td className="px-6 py-3.5 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          isSuper
                            ? 'bg-blue-50 text-primary'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {formatRoleName(staff.role)}
                      </span>
                    </td>

                    <td className="px-6 py-3.5 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          active
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-red-50 text-red-700'
                        }`}
                      >
                        {active ? 'Active' : 'Disabled'}
                      </span>
                    </td>

                    <td className="px-6 py-3.5 text-right whitespace-nowrap">
                      {locked ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400">
                          <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Locked</span>
                        </span>
                      ) : (
                        <div className="inline-flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => onEditClick(staff)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer"
                          >
                            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Edit Permissions</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => onToggleActiveClick(staff)}
                            className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                              active
                                ? 'border-amber-200 bg-white text-amber-800 hover:bg-amber-50'
                                : 'border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50'
                            }`}
                          >
                            {active ? (
                              <>
                                <UserX className="h-3.5 w-3.5" aria-hidden="true" />
                                <span>Disable</span>
                              </>
                            ) : (
                              <>
                                <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
                                <span>Enable</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => onDeleteClick(staff)}
                            className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Delete</span>
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
