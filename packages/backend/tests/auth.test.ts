import { describe, it, expect } from 'vitest';
import { hashPassword, comparePassword } from '../src/utils/password.js';
import { signAccessToken, verifyAccessToken, signRefreshToken, verifyRefreshToken } from '../src/utils/jwt.js';
import { register, login } from '../src/services/auth.service.js';

describe('Password Utils', () => {
  it('should hash a password', async () => {
    const hash = await hashPassword('mysecret123');
    expect(hash).not.toBe('mysecret123');
    expect(hash.startsWith('$2a$')).toBe(true); // bcrypt prefix
  });

  it('should verify a correct password', async () => {
    const hash = await hashPassword('mysecret123');
    const match = await comparePassword('mysecret123', hash);
    expect(match).toBe(true);
  });

  it('should reject an incorrect password', async () => {
    const hash = await hashPassword('mysecret123');
    const match = await comparePassword('wrongpassword', hash);
    expect(match).toBe(false);
  });

  it('should produce different hashes for the same password', async () => {
    const h1 = await hashPassword('password');
    const h2 = await hashPassword('password');
    expect(h1).not.toBe(h2);
  });
});

describe('JWT Utils', () => {
  const mockUser = { id: 'user_123', email: 'test@example.com' };

  it('should sign and verify an access token', () => {
    const token = signAccessToken(mockUser);
    const payload = verifyAccessToken(token);
    expect(payload.sub).toBe('user_123');
    expect(payload.email).toBe('test@example.com');
  });

  it('should sign and verify a refresh token', () => {
    const token = signRefreshToken({ id: 'user_123' }, 'tok_1', 'family_1');
    const payload = verifyRefreshToken(token);
    expect(payload.sub).toBe('user_123');
    expect(payload.jti).toBe('tok_1');
    expect(payload.family).toBe('family_1');
  });

  it('should throw on invalid access token', () => {
    expect(() => verifyAccessToken('invalid.token.here')).toThrow();
  });
});

describe('Auth Service', () => {
  const uniqueSuffix = Date.now();

  it('should register a new user', async () => {
    const result = await register({
      email: `test-${uniqueSuffix}@example.com`,
      password: 'password123',
      name: 'Test User',
    });

    expect(result.user.email).toBe(`test-${uniqueSuffix}@example.com`);
    expect(result.user.name).toBe('Test User');
    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();
    // @ts-expect-error - passwordHash should be excluded
    expect(result.user.passwordHash).toBeUndefined();
  });

  it('should login with valid credentials', async () => {
    const result = await login(`test-${uniqueSuffix}@example.com`, 'password123');
    expect(result.user.email).toBe(`test-${uniqueSuffix}@example.com`);
    expect(result.accessToken).toBeDefined();
  });

  it('should reject duplicate registration', async () => {
    await expect(
      register({ email: `test-${uniqueSuffix}@example.com`, password: 'x', name: 'Dup' })
    ).rejects.toThrow(/already exists/);
  });

  it('should reject login with wrong password', async () => {
    await expect(
      login(`test-${uniqueSuffix}@example.com`, 'wrong')
    ).rejects.toThrow(/Invalid email or password/);
  });

  it('should reject login with non-existent email', async () => {
    await expect(
      login('no-one@example.com', 'password')
    ).rejects.toThrow(/Invalid email or password/);
  });
});
