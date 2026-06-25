import { RouterProvider } from 'react-router';
import { router } from './routes';
import { DataProvider } from './contexts/DataContext';
import { AuthProvider } from './contexts/AuthContext';
import { TenantProvider } from './contexts/TenantContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { CookieConsent } from './components/CookieConsent';

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <TenantProvider>
          <DataProvider>
            <RouterProvider router={router} />
            <CookieConsent />
          </DataProvider>
        </TenantProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
