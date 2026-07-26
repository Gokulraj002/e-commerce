import { ROLES } from '@elite/shared';
import type { Prisma } from '@prisma/client';

import { prisma } from '../../lib/prisma.js';

import type { AddressWriteData } from './user.types.js';

interface FindCustomersArgs {
  skip: number;
  take: number;
  search?: string;
}

/** Prisma access for the user module. No business logic here. */
export const userRepository = {
  findById(id: string) {
    return prisma.user.findUnique({ where: { id } });
  },

  findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  },

  updateProfile(id: string, data: { name?: string; email?: string | null }) {
    return prisma.user.update({ where: { id }, data });
  },

  // ── Addresses ────────────────────────────────────────────────────
  countAddresses(userId: string) {
    return prisma.address.count({ where: { userId } });
  },

  listAddresses(userId: string) {
    return prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  },

  findAddress(id: string) {
    return prisma.address.findUnique({ where: { id } });
  },

  firstAddress(userId: string) {
    return prisma.address.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } });
  },

  /** Create an address; when default, atomically clear any prior default. */
  async createAddress(userId: string, data: AddressWriteData, makeDefault: boolean) {
    const payload = { ...data, userId, isDefault: makeDefault };
    if (!makeDefault) return prisma.address.create({ data: payload });

    const [, address] = await prisma.$transaction([
      prisma.address.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      }),
      prisma.address.create({ data: payload }),
    ]);
    return address;
  },

  /** Update an address; when default, atomically clear any prior default. */
  async updateAddress(
    userId: string,
    id: string,
    data: Prisma.AddressUpdateInput,
    makeDefault: boolean,
  ) {
    if (!makeDefault) return prisma.address.update({ where: { id }, data });

    const [, address] = await prisma.$transaction([
      prisma.address.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      }),
      prisma.address.update({ where: { id }, data: { ...data, isDefault: true } }),
    ]);
    return address;
  },

  deleteAddress(id: string) {
    return prisma.address.delete({ where: { id } });
  },

  promoteDefault(id: string) {
    return prisma.address.update({ where: { id }, data: { isDefault: true } });
  },

  /** Make exactly one address the user's default (clears the rest). */
  setDefaultAddress(userId: string, id: string) {
    return prisma.$transaction([
      prisma.address.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      }),
      prisma.address.update({ where: { id }, data: { isDefault: true } }),
    ]);
  },

  // ── Admin customer management ────────────────────────────────────
  async findCustomers({ skip, take, search }: FindCustomersArgs) {
    const where: Prisma.UserWhereInput = {
      role: ROLES.CUSTOMER,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search } },
            ],
          }
        : {}),
    };

    const [items, total] = await prisma.$transaction([
      prisma.user.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
      prisma.user.count({ where }),
    ]);
    return { items, total };
  },

  findCustomerById(id: string) {
    return prisma.user.findFirst({ where: { id, role: ROLES.CUSTOMER } });
  },
};
