import { ROLES } from '@elite/shared';

import { prisma } from '../../lib/prisma.js';

interface CreateCustomerInput {
  name: string;
  phone: string;
  email: string | null;
  passwordHash: string;
}

interface CreateRefreshTokenInput {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}

/** Prisma access for auth. No business logic here. */
export const authRepository = {
  findByPhone(phone: string) {
    return prisma.user.findUnique({ where: { phone } });
  },

  findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  },

  findById(id: string) {
    return prisma.user.findUnique({ where: { id } });
  },

  /** Create a CUSTOMER together with an empty Cart + Wishlist. */
  createCustomer(input: CreateCustomerInput) {
    return prisma.user.create({
      data: {
        name: input.name,
        phone: input.phone,
        email: input.email,
        passwordHash: input.passwordHash,
        role: ROLES.CUSTOMER,
        cart: { create: {} },
        wishlist: { create: {} },
      },
    });
  },

  updateLastLogin(id: string) {
    return prisma.user.update({ where: { id }, data: { lastLoginAt: new Date() } });
  },

  createRefreshToken(input: CreateRefreshTokenInput) {
    return prisma.refreshToken.create({ data: input });
  },

  findRefreshTokenByHash(tokenHash: string) {
    return prisma.refreshToken.findUnique({ where: { tokenHash } });
  },

  revokeRefreshToken(id: string) {
    return prisma.refreshToken.update({ where: { id }, data: { revokedAt: new Date() } });
  },
};
