import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth-store';
import apiClient from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

export default function AcceptInvitationPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useAuthStore();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    // Wait until session check is complete
    if (isLoading) return;
    if (!token) return;

    if (!isAuthenticated) {
      // Store token and redirect to login — login/register will redirect back
      sessionStorage.setItem('pendingInviteToken', token);
      navigate(`/login`, { replace: true });
      return;
    }

    // User is authenticated — accept the invitation
    apiClient.post(`/workspaces/invitations/${token}/accept`)
      .then((res) => {
        setStatus('success');
        const ws = res.data.data;
        setTimeout(() => navigate(`/workspaces/${ws.id}`, { replace: true }), 2000);
      })
      .catch((err: unknown) => {
        setStatus('error');
        setErrorMsg(
          (err as { response?: { data?: { error?: { message?: string } } } })
            ?.response?.data?.error?.message ?? 'Failed to accept invitation',
        );
      });
  }, [token, isAuthenticated, isLoading, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="text-center space-y-4 max-w-md">
        {status === 'loading' && (
          <div className="space-y-2">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
            <p className="text-muted-foreground">Accepting invitation...</p>
          </div>
        )}
        {status === 'success' && (
          <div>
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-green-600">You're in!</h1>
            <p className="text-muted-foreground mt-2">Redirecting to your new workspace...</p>
          </div>
        )}
        {status === 'error' && (
          <div>
            <h1 className="text-xl font-bold text-destructive">Unable to join</h1>
            <p className="text-sm text-muted-foreground mt-2">{errorMsg}</p>
            <Button className="mt-4" onClick={() => navigate('/')}>
              Go to Dashboard
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
