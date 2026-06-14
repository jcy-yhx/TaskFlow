import { useMutation, useQuery } from '@tanstack/react-query';
import apiClient, { setAccessToken, clearAccessToken } from '@/lib/api-client';
import { useAuthStore, type User } from '@/stores/auth-store';

// ── Types ──
interface AuthResponse {
  data: {
    user: User;
    accessToken: string;
  };
}

interface RefreshResponse {
  data: {
    accessToken: string;
  };
}

// ── Session check on app load ──
export function useSessionCheck() {
  const { logout, login } = useAuthStore();

  return useQuery({
    queryKey: ['session'],
    queryFn: async () => {
      try {
        // Try to refresh — if we have a valid refresh cookie, this succeeds
        const { data } = await apiClient.post<RefreshResponse>('/auth/refresh');
        setAccessToken(data.data.accessToken);

        // Fetch user profile with fresh access token
        const userRes = await apiClient.get<{ data: User }>('/users/me');
        return userRes.data.data;
      } catch {
        clearAccessToken();
        return null;
      }
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
    // If refresh fails, user is not authenticated
    placeholderData: null as User | null,
    select: (user) => {
      if (user) {
        // Don't call login() here — we don't have a fresh access token
        // The session check only confirms the cookie is valid
        useAuthStore.setState({ isLoading: false });
      } else {
        logout();
      }
      return user;
    },
  });
}

// ── Register ──
export function useRegister() {
  const { login } = useAuthStore();

  return useMutation({
    mutationFn: async (input: { email: string; password: string; name: string }) => {
      const { data } = await apiClient.post<AuthResponse>('/auth/register', input);
      return data.data;
    },
    onSuccess: (result) => {
      login(result.user, result.accessToken);
    },
  });
}

// ── Login ──
export function useLogin() {
  const { login } = useAuthStore();

  return useMutation({
    mutationFn: async (input: { email: string; password: string }) => {
      const { data } = await apiClient.post<AuthResponse>('/auth/login', input);
      return data.data;
    },
    onSuccess: (result) => {
      login(result.user, result.accessToken);
    },
  });
}

// ── Logout ──
export function useLogout() {
  const { logout } = useAuthStore();

  return useMutation({
    mutationFn: async () => {
      await apiClient.post('/auth/logout');
    },
    onSettled: () => {
      logout();
    },
  });
}
