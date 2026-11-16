import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { LoadingScreen } from './components/LoadingScreen';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AccessDeniedPage } from './pages/AccessDeniedPage';
import { ClientProfilePage } from './pages/ClientProfilePage';
import { ClientsPage } from './pages/ClientsPage';
import { DashboardPage } from './pages/DashboardPage';
import { DocumentsPage } from './pages/DocumentsPage';
import { LedgerPage } from './pages/LedgerPage';
import { LoginPage } from './pages/LoginPage';
import { PermissionsPage } from './pages/PermissionsPage';

/**
 * Handles authentication gates and protected office routes.
 */
function AppRouter() {
  const { user, profile, loading, accessDenied, authError, signOut } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <LoginPage />;
  }

  if (accessDenied) {
    return <AccessDeniedPage />;
  }

  if (!profile || profile.isActive !== true) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-8 text-center shadow-sm">
          <h1 className="font-display text-lg font-semibold text-slate-900">
            Session Verification Error
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            {authError || 'Could not load your staff profile. Please sign out and try again.'}
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={signOut}
              className="rounded-lg bg-[#0F2942] px-4 py-2 text-sm font-medium text-white hover:bg-[#163859] cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route
          path="/clients"
          element={
            <ProtectedRoute module="clients">
              <ClientsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/clients/:id"
          element={
            <ProtectedRoute module="clients">
              <ClientProfilePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ledger"
          element={
            <ProtectedRoute module="ledger">
              <LedgerPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/documents"
          element={
            <ProtectedRoute module="documents">
              <DocumentsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/permissions"
          element={
            <ProtectedRoute requireSuperAdmin>
              <PermissionsPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </BrowserRouter>
  );
}
