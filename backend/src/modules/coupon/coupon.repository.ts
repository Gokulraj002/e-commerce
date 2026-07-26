import type { Prisma } from '@prisma/client';

import { prisma } from '../../lib/prisma.js';

/** Prisma access only. Returns plain data; no business logic. */
export const couponRepository = {
  findByCode(code: string) {
    return prisma.coupon.findUnique({ where: { code } });
  },

  findById(id: string) {
    return prisma.coupon.findUnique({ where: { id } });
  },

  list() {
    return prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } });
  },

  create(data: Prisma.CouponUncheckedCreateInput) {
    return prisma.coupon.create({ data });
  },

  update(id: string, data: Prisma.CouponUncheckedUpdateInput) {
    return prisma.coupon.update({ where: { id }, data });
  },

  remove(id: string) {
    return prisma.coupon.delete({ where: { id } });
  },
};
