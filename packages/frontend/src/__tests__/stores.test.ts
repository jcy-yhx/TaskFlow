import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from '@/stores/auth-store';

describe('AuthStore', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
    });
  });

  it('should start in logged out state', () => {
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBe(null);
  });

  it('should login successfully', () => {
    const mockUser = { id: '1', email: 'test@test.com', name: 'Test', avatarUrl: null };

    useAuthStore.getState().login(mockUser, 'access-token-123');

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.user?.email).toBe('test@test.com');
    expect(state.isLoading).toBe(false);
  });

  it('should logout successfully', () => {
    const mockUser = { id: '1', email: 'test@test.com', name: 'Test', avatarUrl: null };
    useAuthStore.getState().login(mockUser, 'token');

    useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBe(null);
  });
});
