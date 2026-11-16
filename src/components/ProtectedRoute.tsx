import React from 'react';
import { Navigate } from 'react-router-dom';
import { ActionKey, ModuleKey, useAuth } from '../context/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  module?: ModuleKey;
  action?: ActionKey;
  requireSuperAdmin?: boolean;
}

/**
 * Guards route access based on the user's Firestore permissions or super_admin role.
 * Unauthorized users are redirected cleanly back to the Dashboard.
 */
export function ProtectedRoute({
  children,
  module,
  action = 'view',
  requireSuperAdmin = false,
}: ProtectedRouteProps) {
  const { isSuperAdmin, can } = useAuth();

  if (requireSuperAdmin && !isSuperAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  if (module && !can(module, action)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
