import { Prisma } from '@prisma/client';

import { prisma } from '../../lib/prisma.js';

/** Prisma access ONLY for reviews. Mapping and rules live in the service. */

export const reviewInclude = Prisma.validator<Prisma.ReviewInclude>()({
  user: { select: { name: true } },
});
export type ReviewRow = Prisma.ReviewGetPayload<{ include: typeof reviewInclude }>;

export function findProductById(id: string) {
  return prisma.product.findUnique({ where: { id } });
}

export function findApprovedByProduct(productId: string, skip: number, take: number) {
  return prisma.review.findMany({
    where: { productId, isApproved: true },
    orderBy: { createdAt: 'desc' },
    skip,
    take,
    include: reviewInclude,
  });
}

export function countApprovedByProduct(productId: string) {
  return prisma.review.count({ where: { productId, isApproved: true } });
}

export function findByProductAndUser(productId: string, userId: string) {
  return prisma.review.findUnique({
    where: { productId_userId: { productId, userId } },
  });
}

export function createReview(data: {
  productId: string;
  userId: string;
  rating: number;
  title?: string;
  body?: string;
}) {
  return prisma.review.create({ data, include: reviewInclude });
}

export function findReviewById(id: string) {
  return prisma.review.findUnique({ where: { id }, include: reviewInclude });
}

export function approveReview(id: string) {
  return prisma.review.update({
    where: { id },
    data: { isApproved: true },
    include: reviewInclude,
  });
}

export function deleteReview(id: string) {
  return prisma.review.delete({ where: { id } });
}

export function findPending(skip: number, take: number) {
  return prisma.review.findMany({
    where: { isApproved: false },
    orderBy: { createdAt: 'asc' },
    skip,
    take,
    include: reviewInclude,
  });
}

export function countPending() {
  return prisma.review.count({ where: { isApproved: false } });
}

/** Aggregate approved reviews for a product (drives product.rating). */
export function aggregateApproved(productId: string) {
  return prisma.review.aggregate({
    where: { productId, isApproved: true },
    _avg: { rating: true },
    _count: { _all: true },
  });
}

export function updateProductRating(productId: string, rating: number, ratingCount: number) {
  return prisma.product.update({
    where: { id: productId },
    data: { rating, ratingCount },
  });
}
