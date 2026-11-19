interface ClientAvatarProps {
  name: string;
  photoData?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

function getInitials(name: string): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

const SIZE_CLASSES: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-12 w-12 text-sm',
  lg: 'h-16 w-16 text-base',
};

/**
 * Round client avatar displaying the stored base64 photoData when present,
 * falling back to centered initials.
 */
export function ClientAvatar({
  name,
  photoData,
  size = 'sm',
  className = '',
}: ClientAvatarProps) {
  const sizeClass = SIZE_CLASSES[size];

  if (photoData && photoData.startsWith('data:image/')) {
    return (
      <img
        src={photoData}
        alt={name}
        className={`${sizeClass} shrink-0 rounded-full object-cover border border-slate-200 bg-white ${className}`}
      />
    );
  }

  return (
    <span
      className={`${sizeClass} inline-flex shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary ${className}`}
      aria-hidden="true"
    >
      {getInitials(name)}
    </span>
  );
}
