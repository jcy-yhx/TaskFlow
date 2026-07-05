import { useEffect } from 'react';
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

// ── Session check on app load ──
export function useSessionCheck() {
  const { data } = useQuery({
    queryKey: ['session'],
    queryFn: async () => {
      try {
        const { data } = await apiClient.post<{ data: { accessToken: string } }>('/auth/refresh');
        setAccessToken(data.data.accessToken);

        const userRes = await apiClient.get<{ data: User }>('/users/me');
        return userRes.data.data;
      } catch {
        clearAccessToken();
        return null;
      }
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Handle session check result — side effects must not run during render
  useEffect(() => {
    if (data !== undefined) {
      if (data) {
        useAuthStore.setState({ user: data as User, isAuthenticated: true, isLoading: false });
      } else {
        useAuthStore.setState({ isLoading: false });
      }
    }
  }, [data]);
}

// ── Register ──
export function useRegister() {
  const login = useAuthStore((s) => s.login);

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
  const login = useAuthStore((s) => s.login);

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
  const logout = useAuthStore((s) => s.logout);

  return useMutation({
    mutationFn: async () => {
      try {
        await apiClient.post('/auth/logout');
      } catch { /* token might already be expired */ }
    },
    onSettled: () => {
      logout();
    },
  });
}
