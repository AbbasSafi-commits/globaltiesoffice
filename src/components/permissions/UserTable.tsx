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
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
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
            className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#1D4ED8] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/15"
          />
        </div>

        <button
          type="button"
          onClick={onInviteClick}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#0F2942] px-4 py-2 text-sm font-medium text-white hover:bg-[#163859] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4ED8] cursor-pointer"
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
              className="h-11 w-full rounded-md bg-slate-100 animate-pulse"
            />
          ))}
        </div>
      ) : users.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <p className="text-sm font-medium text-slate-900">No users invited yet</p>
          <p className="mt-1 text-sm text-slate-500">
            Click &ldquo;Invite User&rdquo; to grant a staff member access to Global Ties Office.
          </p>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <p className="text-sm font-medium text-slate-900">No matching staff members</p>
          <p className="mt-1 text-sm text-slate-500">
            Try clearing or adjusting your search filter.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-medium text-slate-500">
                <th className="px-6 py-3">Name</th>
                <th className="px-6 py-3">Gmail</th>
                <th className="px-6 py-3">Role</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredUsers.map((staff) => {
                const locked = isLockedAccount(staff.email);
                const active = staff.isActive === true;
                const isSuper = staff.role === 'super_admin';

                return (
                  <tr key={staff.email} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-6 py-3.5 font-medium text-slate-900 whitespace-nowrap">
                      {staff.fullName}
                    </td>

                    <td className="px-6 py-3.5 font-mono text-xs text-slate-600 whitespace-nowrap">
                      {staff.email}
                    </td>

                    <td className="px-6 py-3.5 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium border ${
                          isSuper
                            ? 'bg-blue-50 text-[#0F2942] border-blue-200'
                            : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        {formatRoleName(staff.role)}
                      </span>
                    </td>

                    <td className="px-6 py-3.5 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium border ${
                          active
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-red-50 text-red-700 border-red-200'
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
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer"
                          >
                            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Edit Permissions</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => onToggleActiveClick(staff)}
                            className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                              active
                                ? 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
                                : 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
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
                            className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-white px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
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
