import { Eye, Pencil, Plus, Search, Trash2, Users } from 'lucide-react';
import {
  CLIENT_STATUS_OPTIONS,
  ClientRecord,
  ClientStatus,
  formatClientDate,
  PRESET_CLIENT_TYPES,
} from './clientTypes';

interface ClientTableProps {
  clients: ClientRecord[];
  loading: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  typeFilter: string;
  onTypeFilterChange: (val: string) => void;
  statusFilter: string;
  onStatusFilterChange: (val: string) => void;
  canAdd: boolean;
  canEdit: boolean;
  canDelete: boolean;
  onAddClick: () => void;
  onViewClick: (client: ClientRecord) => void;
  onEditClick: (client: ClientRecord) => void;
  onDeleteClick: (client: ClientRecord) => void;
}

function getStatusBadgeClass(status: ClientStatus): string {
  switch (status) {
    case 'Active':
      return 'bg-emerald-50 text-emerald-700';
    case 'Pending':
      return 'bg-amber-50 text-amber-800';
    case 'Completed':
      return 'bg-blue-50 text-primary';
    case 'On Hold':
    default:
      return 'bg-slate-100 text-slate-600';
  }
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

/**
 * Displays the searchable, filterable table of clients with permission-aware actions,
 * sticky header, avatar initials, pill badges, and incremental 25-record pagination.
 */
export function ClientTable({
  clients,
  loading,
  hasMore,
  loadingMore,
  onLoadMore,
  searchQuery,
  onSearchChange,
  typeFilter,
  onTypeFilterChange,
  statusFilter,
  onStatusFilterChange,
  canAdd,
  canEdit,
  canDelete,
  onAddClick,
  onViewClick,
  onEditClick,
  onDeleteClick,
}: ClientTableProps) {
  const availableTypes = Array.from(
    new Set<string>([
      ...PRESET_CLIENT_TYPES,
      ...clients.map((c) => c.clientType).filter(Boolean),
    ])
  );

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredClients = clients.filter((client) => {
    if (typeFilter !== 'all' && client.clientType !== typeFilter) {
      return false;
    }
    if (statusFilter !== 'all' && client.status !== statusFilter) {
      return false;
    }
    if (!normalizedQuery) return true;

    const haystacks = [
      client.nameLower || client.name,
      client.fatherName,
      client.mobile,
      client.cnic,
      client.ntn,
    ];
    return haystacks.some((field) => (field || '').toLowerCase().includes(normalizedQuery));
  });

  const hasActiveFilters =
    normalizedQuery.length > 0 || typeFilter !== 'all' || statusFilter !== 'all';

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
      {/* Toolbar: Search, Filters, Add Client */}
      <div className="p-4 sm:px-6 sm:py-4 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search
              className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search name, father name, mobile, CNIC, or NTN..."
              aria-label="Search clients"
              className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="flex items-center gap-2.5">
            <select
              value={typeFilter}
              onChange={(e) => onTypeFilterChange(e.target.value)}
              aria-label="Filter by Client Type"
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="all">All Types</option>
              {availableTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => onStatusFilterChange(e.target.value)}
              aria-label="Filter by Status"
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="all">All Statuses</option>
              {CLIENT_STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
        </div>

        {canAdd && (
          <button
            type="button"
            onClick={onAddClick}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover transition-colors whitespace-nowrap shrink-0 shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary cursor-pointer"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>Add Client</span>
          </button>
        )}
      </div>

      {/* Table States */}
      {loading ? (
        <div className="p-6 space-y-3" aria-busy="true" aria-label="Loading clients">
          {[1, 2, 3, 4, 5].map((row) => (
            <div key={row} className="h-12 w-full rounded-lg bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : clients.length === 0 ? (
        <div className="px-6 py-14 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-500">
            <Users className="h-5 w-5" aria-hidden="true" />
          </div>
          <p className="text-sm font-medium text-slate-900">No clients added yet</p>
          <p className="mt-1 text-sm text-slate-500">
            Client profiles and identity records will appear here once added.
          </p>
          {canAdd && (
            <button
              type="button"
              onClick={onAddClick}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover transition-colors shadow-xs cursor-pointer"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span>Add First Client</span>
            </button>
          )}
        </div>
      ) : filteredClients.length === 0 ? (
        <div className="px-6 py-14 text-center space-y-2">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-500">
            <Search className="h-5 w-5" aria-hidden="true" />
          </div>
          <p className="text-sm font-medium text-slate-900">No matching clients found</p>
          <p className="text-sm text-slate-500">
            Try clearing your search or adjusting the Client Type and Status filters.
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => {
                onSearchChange('');
                onTypeFilterChange('all');
                onStatusFilterChange('all');
              }}
              className="mt-2 inline-flex items-center rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Clear Filters
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="overflow-auto max-h-[640px]">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 z-10 bg-table-head/95 backdrop-blur-xs border-b border-border">
                <tr className="text-xs font-medium text-slate-500">
                  <th className="px-5 py-3.5 whitespace-nowrap">Name</th>
                  <th className="px-5 py-3.5 whitespace-nowrap">Father Name</th>
                  <th className="px-5 py-3.5 whitespace-nowrap">Client Type</th>
                  <th className="px-5 py-3.5 whitespace-nowrap">Mobile</th>
                  <th className="px-5 py-3.5 whitespace-nowrap">CNIC</th>
                  <th className="px-5 py-3.5 whitespace-nowrap">Status</th>
                  <th className="px-5 py-3.5 whitespace-nowrap">Added Date</th>
                  <th className="px-5 py-3.5 text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredClients.map((client) => (
                  <tr key={client.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onViewClick(client)}
                        className="inline-flex items-center gap-2.5 text-left font-medium text-slate-900 hover:text-primary transition-colors cursor-pointer group"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600 group-hover:bg-blue-50 group-hover:text-primary">
                          {getInitials(client.name)}
                        </span>
                        <span>{client.name}</span>
                      </button>
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 whitespace-nowrap">
                      {client.fatherName || '—'}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                        {client.clientType}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs tabular-nums text-slate-700 whitespace-nowrap">
                      {client.mobile}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs tabular-nums text-slate-600 whitespace-nowrap">
                      {client.cnic || '—'}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusBadgeClass(
                          client.status
                        )}`}
                      >
                        {client.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-xs font-mono tabular-nums text-slate-500 whitespace-nowrap">
                      {formatClientDate(client.createdAt)}
                    </td>
                    <td className="px-5 py-3.5 text-right whitespace-nowrap">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => onViewClick(client)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer"
                        >
                          <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>View</span>
                        </button>

                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => onEditClick(client)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer"
                          >
                            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Edit</span>
                          </button>
                        )}

                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => onDeleteClick(client)}
                            className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Delete</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {hasMore && (
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between gap-4">
              <span className="text-xs text-slate-500 tabular-nums">
                Showing {clients.length} loaded client{clients.length === 1 ? '' : 's'}
              </span>
              <button
                type="button"
                onClick={onLoadMore}
                disabled={loadingMore}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 transition-colors cursor-pointer"
              >
                {loadingMore ? 'Loading...' : 'Load More (25)'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
