import { Routes, Route } from 'react-router-dom';
import { useSessionCheck } from '@/api/auth';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import AuthLayout from '@/components/layout/AuthLayout';
import LoginPage from '@/pages/LoginPage';
import RegisterPage from '@/pages/RegisterPage';
import OAuthCallbackPage from '@/pages/OAuthCallbackPage';
import DashboardPage from '@/pages/DashboardPage';

export default function App() {
  // Fire session check on mount — tries to restore session from refresh cookie
  useSessionCheck();

  return (
    <Routes>
      {/* Public auth routes */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>

      {/* OAuth callback (no layout — just a spinner) */}
      <Route path="/oauth/callback" element={<OAuthCallbackPage />} />

      {/* Protected routes */}
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<DashboardPage />} />
        {/* More routes added in Phase 2+ */}
      </Route>

      {/* Catch-all */}
      <Route path="*" element={
        <div className="flex min-h-screen items-center justify-center">
          <p className="text-muted-foreground">Page not found</p>
        </div>
      } />
    </Routes>
  );
}
