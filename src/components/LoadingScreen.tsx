import { BrandLogo } from './BrandLogo';

interface LoadingScreenProps {
  message?: string;
}

/**
 * Full-screen loading state shown while verifying the active session and profile.
 */
export function LoadingScreen({ message = 'Verifying authorized access...' }: LoadingScreenProps) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-6">
      <div className="flex flex-col items-center gap-6 text-center">
        <BrandLogo variant="dark" size="lg" />
        <div className="flex flex-col items-center gap-3">
          <div
            className="h-8 w-8 rounded-full border-2 border-slate-200 border-t-[#1D4ED8] animate-spin"
            role="status"
            aria-label="Loading"
          />
          <p className="text-sm text-slate-600">{message}</p>
        </div>
      </div>
    </div>
  );
}
