import { Navigate } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import type { ServiceKey } from '../contexts/TenantContext';

export function ServiceRoute({ service, children }: { service: ServiceKey; children: React.ReactNode }) {
  const { user } = useAuth();

  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'superadmin') return <>{children}</>;
  if (user.enabledServices?.includes(service)) return <>{children}</>;

  return <Navigate to="/" replace />;
}
