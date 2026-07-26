import type { AuthResult, AuthTokens, RegisterInput, UserDTO } from '@elite/shared';
import type { User } from '@prisma/client';
import argon2 from 'argon2';

import { ApiError } from '../../utils/ApiError.js';

import { authRepository } from './auth.repository.js';
import type { LoginInput } from './auth.schema.js';
import {
  getTokenExpiry,
  hashRefreshToken,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  type TokenPayload,
} from './auth.tokens.js';

/** Map a Prisma User to the client-safe DTO. Never leaks passwordHash. */
function toUserDTO(user: User): UserDTO {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    isMember: user.isMember,
    createdAt: user.createdAt.toISOString(),
  };
}

/** Issue an access+refresh pair and persist the hashed refresh token. */
async function issueTokens(user: User): Promise<AuthTokens> {
  const payload: TokenPayload = { sub: user.id, role: user.role };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);
  await authRepository.createRefreshToken({
    userId: user.id,
    tokenHash: hashRefreshToken(refreshToken),
    expiresAt: getTokenExpiry(refreshToken),
  });
  return { accessToken, refreshToken };
}

export const authService = {
  async register(input: RegisterInput): Promise<AuthResult> {
    const phoneTaken = await authRepository.findByPhone(input.phone);
    if (phoneTaken) throw ApiError.conflict('Phone number is already registered');

    if (input.email) {
      const emailTaken = await authRepository.findByEmail(input.email);
      if (emailTaken) throw ApiError.conflict('Email is already registered');
    }

    const passwordHash = await argon2.hash(input.password);
    const user = await authRepository.createCustomer({
      name: input.name,
      phone: input.phone,
      email: input.email ?? null,
      passwordHash,
    });

    const tokens = await issueTokens(user);
    return { user: toUserDTO(user), tokens };
  },

  async login(input: LoginInput): Promise<AuthResult> {
    const user = input.email
      ? await authRepository.findByEmail(input.email)
      : input.phone
        ? await authRepository.findByPhone(input.phone)
        : null;
    if (!user) throw ApiError.unauthorized('Invalid credentials');

    const valid = await argon2.verify(user.passwordHash, input.password);
    if (!valid) throw ApiError.unauthorized('Invalid credentials');

    if (!user.isActive) throw ApiError.forbidden('Account is disabled');

    const updated = await authRepository.updateLastLogin(user.id);
    const tokens = await issueTokens(updated);
    return { user: toUserDTO(updated), tokens };
  },

  /** Rotate a refresh token: verify → revoke old → issue new pair. */
  async refresh(refreshToken: string): Promise<AuthTokens> {
    let payload: TokenPayload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      throw ApiError.unauthorized('Invalid refresh token');
    }

    const stored = await authRepository.findRefreshTokenByHash(hashRefreshToken(refreshToken));
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw ApiError.unauthorized('Refresh token is expired or revoked');
    }

    await authRepository.revokeRefreshToken(stored.id);

    const user = await authRepository.findById(payload.sub);
    if (!user || !user.isActive) throw ApiError.unauthorized('Account not found or disabled');

    return issueTokens(user);
  },

  /** Revoke a refresh token. Idempotent — unknown tokens are a no-op. */
  async logout(refreshToken: string): Promise<void> {
    const stored = await authRepository.findRefreshTokenByHash(hashRefreshToken(refreshToken));
    if (stored && !stored.revokedAt) {
      await authRepository.revokeRefreshToken(stored.id);
    }
  },

  async me(userId: string): Promise<UserDTO> {
    const user = await authRepository.findById(userId);
    if (!user) throw ApiError.notFound('User not found');
    return toUserDTO(user);
  },
};
