import { Globe } from 'lucide-react';

interface BrandLogoProps {
  variant?: 'light' | 'dark';
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Clean globe and wordmark logo for Global Ties Office.
 */
export function BrandLogo({ variant = 'dark', size = 'md' }: BrandLogoProps) {
  const isLight = variant === 'light';

  const iconSizes = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
  };

  const containerSizes = {
    sm: 'h-8 w-8 rounded-lg',
    md: 'h-9 w-9 rounded-lg',
    lg: 'h-10 w-10 rounded-xl',
  };

  const textSizes = {
    sm: 'text-[15px]',
    md: 'text-base',
    lg: 'text-lg',
  };

  return (
    <div className="inline-flex items-center gap-2.5 shrink-0">
      <div
        className={`flex items-center justify-center shrink-0 ${containerSizes[size]} ${
          isLight
            ? 'bg-[#2563EB] text-white shadow-xs'
            : 'bg-[#0F172A] text-white shadow-xs'
        }`}
      >
        <Globe className={iconSizes[size]} strokeWidth={2} aria-hidden="true" />
      </div>
      <span
        className={`font-semibold tracking-tight whitespace-nowrap ${textSizes[size]} ${
          isLight ? 'text-white' : 'text-[#0F172A]'
        }`}
      >
        Global Ties Office
      </span>
    </div>
  );
}
