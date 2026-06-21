import { Navigate } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { useTenants } from '../contexts/TenantContext';
import type { ServiceKey } from '../contexts/TenantContext';

export function ServiceRoute({ service, children }: { service: ServiceKey; children: React.ReactNode }) {
  const { user } = useAuth();
  const { selectedTenant } = useTenants();

  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'superadmin') {
    if (!selectedTenant) return <Navigate to="/mcc/tenants" replace />;
    return selectedTenant.enabledServices.includes(service) ? <>{children}</> : <Navigate to="/mcc/tenants" replace />;
  }
  if (user.enabledServices?.includes(service)) return <>{children}</>;

  return <Navigate to="/" replace />;
}
