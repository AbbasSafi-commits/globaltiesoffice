interface BrandLogoProps {
  variant?: 'light' | 'dark';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  hideLabelOnMobile?: boolean;
}

/**
 * Clean logo and wordmark for Global Ties using /logo.png.
 */
export function BrandLogo({
  variant = 'dark',
  size = 'md',
  showLabel = true,
  hideLabelOnMobile = false,
}: BrandLogoProps) {
  const isLight = variant === 'light';

  const containerSizes = {
    sm: 'h-8 w-8 rounded-lg',
    md: 'h-9 w-9 rounded-lg',
    lg: 'h-10 w-10 rounded-lg',
  };

  const textSizes = {
    sm: 'text-[15px]',
    md: 'text-base',
    lg: 'text-lg',
  };

  return (
    <div className="inline-flex items-center gap-2.5 shrink-0">
      <div
        className={`flex items-center justify-center shrink-0 overflow-hidden bg-white p-0.5 ${
          containerSizes[size]
        } ${isLight ? 'shadow-xs' : 'border border-slate-200 shadow-2xs'}`}
      >
        <img
          src="/logo-icon.png"
          alt="Global Ties logo"
          className="h-full w-full object-contain"
        />
      </div>
      {showLabel && (
        <span
          className={`font-semibold tracking-tight whitespace-nowrap ${textSizes[size]} ${
            isLight ? 'text-white' : 'text-ink'
          } ${hideLabelOnMobile ? 'hidden sm:inline' : ''}`}
        >
          Global Ties
        </span>
      )}
    </div>
  );
}
