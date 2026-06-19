import { Navigate } from 'react-router';
import { useAuth } from '../contexts/AuthContext';

export function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (user?.role !== 'superadmin') {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
