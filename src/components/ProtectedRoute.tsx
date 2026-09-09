import React from 'react';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
  fallback?: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
  fallback,
}) => {
  const { isAuthenticated, role, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8 text-slate-400">
        Authenticating...
      </div>
    );
  }

  if (!isAuthenticated) {
    return fallback ? (
      <>{fallback}</>
    ) : (
      <div className="p-8 text-center bg-slate-900/60 rounded-xl border border-slate-800 text-slate-300">
        <h3 className="text-lg font-semibold mb-2">Authentication Required</h3>
        <p className="text-sm text-slate-400">Please sign in to access this platform view.</p>
      </div>
    );
  }

  if (allowedRoles && role && !allowedRoles.includes(role)) {
    return (
      <div className="p-8 text-center bg-red-950/30 rounded-xl border border-red-900/50 text-red-300">
        <h3 className="text-lg font-semibold mb-2">Access Restricted</h3>
        <p className="text-sm text-red-400">Your role ({role}) does not have permission to view this section.</p>
      </div>
    );
  }

  return <>{children}</>;
};
