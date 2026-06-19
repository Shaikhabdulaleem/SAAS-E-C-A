import { RouterProvider } from 'react-router';
import { router } from './routes';
import { DataProvider } from './contexts/DataContext';
import { AuthProvider } from './contexts/AuthContext';
import { TenantProvider } from './contexts/TenantContext';

export default function App() {
  return (
    <AuthProvider>
      <TenantProvider>
        <DataProvider>
          <RouterProvider router={router} />
        </DataProvider>
      </TenantProvider>
    </AuthProvider>
  );
}
