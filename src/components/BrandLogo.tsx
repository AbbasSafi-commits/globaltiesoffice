import { Globe } from 'lucide-react';

interface BrandLogoProps {
  variant?: 'light' | 'dark';
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Simple text and globe logo for Global Ties Office.
 */
export function BrandLogo({ variant = 'dark', size = 'md' }: BrandLogoProps) {
  const isLight = variant === 'light';

  const iconSizes = {
    sm: 'h-5 w-5',
    md: 'h-6 w-6',
    lg: 'h-7 w-7',
  };

  const textSizes = {
    sm: 'text-base',
    md: 'text-lg',
    lg: 'text-xl',
  };

  return (
    <div className="inline-flex items-center gap-2.5 shrink-0">
      <div
        className={`flex items-center justify-center rounded-lg p-1.5 ${
          isLight
            ? 'bg-white/10 text-blue-200 ring-1 ring-white/15'
            : 'bg-[#0F2942] text-white'
        }`}
      >
        <Globe className={iconSizes[size]} strokeWidth={1.85} aria-hidden="true" />
      </div>
      <span
        className={`font-display font-semibold tracking-tight whitespace-nowrap ${textSizes[size]} ${
          isLight ? 'text-white' : 'text-[#0F2942]'
        }`}
      >
        Global Ties Office
      </span>
    </div>
  );
}
