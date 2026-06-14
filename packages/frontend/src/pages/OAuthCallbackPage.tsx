import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore, type User } from '@/stores/auth-store';
import { setAccessToken } from '@/lib/api-client';

export default function OAuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;

    const accessToken = searchParams.get('access_token');
    const userRaw = searchParams.get('user');

    if (accessToken && userRaw) {
      try {
        const user = JSON.parse(userRaw) as User;
        setAccessToken(accessToken);
        useAuthStore.setState({ user, isAuthenticated: true, isLoading: false });
        navigate('/', { replace: true });
      } catch {
        navigate('/login', { replace: true });
      }
    } else {
      navigate('/login', { replace: true });
    }
  }, [searchParams, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <p className="text-muted-foreground">Completing sign in...</p>
    </div>
  );
}
