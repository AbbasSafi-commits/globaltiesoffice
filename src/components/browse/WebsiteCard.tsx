import React, { useEffect, useRef, useState } from 'react';
import { MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { getFaviconUrl, WebsiteRecord } from './browseTypes';

interface WebsiteCardProps {
  website: WebsiteRecord;
  isSuperAdmin: boolean;
  isDragging?: boolean;
  isDragOver?: boolean;
  onOpen: (website: WebsiteRecord) => void;
  onEdit: (website: WebsiteRecord) => void;
  onDelete: (website: WebsiteRecord) => void;
  onDragStart?: (e: React.DragEvent, website: WebsiteRecord) => void;
  onDragOver?: (e: React.DragEvent, website: WebsiteRecord) => void;
  onDrop?: (e: React.DragEvent, website: WebsiteRecord) => void;
  onDragEnd?: () => void;
}

const AVATAR_COLORS = [
  'bg-[#2563EB]',
  'bg-slate-700',
  'bg-indigo-600',
  'bg-sky-600',
  'bg-teal-600',
  'bg-emerald-600',
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getFirstLetter(name: string): string {
  const trimmed = name.trim();
  return trimmed ? trimmed[0].toUpperCase() : 'W';
}

/**
 * Chrome New Tab style circular shortcut tile with 64px tinted circle,
 * 128px favicon (with colored first-letter fallback), centered single-line title,
 * Super Admin three-dot menu, and drag-and-drop support.
 */
export function WebsiteCard({
  website,
  isSuperAdmin,
  isDragging = false,
  isDragOver = false,
  onOpen,
  onEdit,
  onDelete,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: WebsiteCardProps) {
  const [faviconFailed, setFaviconFailed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const faviconUrl = getFaviconUrl(website.url);

  useEffect(() => {
    if (!menuOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  return (
    <div
      draggable={isSuperAdmin}
      onDragStart={(e) => isSuperAdmin && onDragStart?.(e, website)}
      onDragOver={(e) => isSuperAdmin && onDragOver?.(e, website)}
      onDrop={(e) => isSuperAdmin && onDrop?.(e, website)}
      onDragEnd={() => isSuperAdmin && onDragEnd?.()}
      className={`group relative flex flex-col items-center rounded-2xl px-2 py-3.5 transition-all duration-150 select-none ${
        isDragging ? 'opacity-40 scale-95' : 'hover:-translate-y-0.5 hover:bg-slate-200/55'
      } ${isDragOver ? 'ring-2 ring-[#2563EB]/40 bg-[#2563EB]/5' : ''}`}
    >
      {/* Super Admin Three-Dot Menu (always visible on mobile, on hover on desktop) */}
      {isSuperAdmin && (
        <div
          ref={menuRef}
          className={`absolute top-1.5 right-1.5 z-10 transition-opacity ${
            menuOpen
              ? 'opacity-100'
              : 'opacity-100 lg:opacity-0 lg:group-hover:opacity-100 lg:focus-within:opacity-100'
          }`}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((prev) => !prev);
            }}
            aria-label={`More actions for ${website.name}`}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            className="flex h-7 w-7 items-center justify-center rounded-full text-slate-500 hover:bg-slate-200/80 hover:text-slate-900 transition-colors cursor-pointer"
          >
            <MoreVertical className="h-4 w-4" aria-hidden="true" />
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 mt-1 w-32 rounded-xl border border-slate-200 bg-white py-1 shadow-lg z-30"
            >
              <button
                type="button"
                role="menuitem"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  onEdit(website);
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer"
              >
                <Pencil className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                <span>Edit</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  onDelete(website);
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5 text-red-600" aria-hidden="true" />
                <span>Delete</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Main Clickable Shortcut Tile */}
      <button
        type="button"
        onClick={() => onOpen(website)}
        title={website.name}
        className="flex w-full flex-col items-center gap-2.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] rounded-xl cursor-pointer"
      >
        <div
          className={`flex h-16 w-16 items-center justify-center rounded-full overflow-hidden transition-transform ${
            faviconUrl && !faviconFailed
              ? 'bg-[#2563EB]/10'
              : `${getAvatarColor(website.name)} text-white`
          }`}
        >
          {faviconUrl && !faviconFailed ? (
            <img
              src={faviconUrl}
              alt=""
              className="h-8 w-8 object-contain"
              loading="lazy"
              onError={() => setFaviconFailed(true)}
            />
          ) : (
            <span className="text-xl font-semibold tracking-tight">
              {getFirstLetter(website.name)}
            </span>
          )}
        </div>

        <span className="w-full px-1 text-center text-sm font-medium text-slate-800 truncate">
          {website.name}
        </span>
      </button>
    </div>
  );
}
