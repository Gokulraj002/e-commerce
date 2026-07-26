import { Prisma } from '@prisma/client';

import { prisma } from '../../lib/prisma.js';
import type {
  CreateAttributeInput,
  CreateBrandInput,
  CreateCategoryInput,
  CreateImageInput,
  CreateProductInput,
  CreateVariantInput,
  UpdateBrandInput,
  UpdateCategoryInput,
  UpdateProductInput,
  UpdateVariantInput,
} from './catalog.schema.js';

/**
 * Prisma access ONLY. Every function returns plain Prisma data; all mapping to
 * DTOs and all business rules live in the service.
 */

// ── Shared include shapes (typed via Prisma.validator) ─────────────
export const productListInclude = Prisma.validator<Prisma.ProductInclude>()({
  images: { orderBy: { sortOrder: 'asc' } },
  variants: {
    where: { isActive: true },
    orderBy: { weightG: 'asc' },
    include: { inventory: true },
  },
});
export type ProductListRow = Prisma.ProductGetPayload<{
  include: typeof productListInclude;
}>;

export const productDetailInclude = Prisma.validator<Prisma.ProductInclude>()({
  images: { orderBy: { sortOrder: 'asc' } },
  variants: {
    where: { isActive: true },
    orderBy: { weightG: 'asc' },
    include: { inventory: true },
  },
  attributes: {
    include: { attributeValue: { include: { attribute: true } } },
  },
  reviews: {
    where: { isApproved: true },
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { name: true } } },
  },
});
export type ProductDetailRow = Prisma.ProductGetPayload<{
  include: typeof productDetailInclude;
}>;

const attributeInclude = Prisma.validator<Prisma.AttributeInclude>()({
  values: true,
});
export type AttributeRow = Prisma.AttributeGetPayload<{
  include: typeof attributeInclude;
}>;

// ── Categories ─────────────────────────────────────────────────────
export function findAllCategories() {
  return prisma.category.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });
}

export function findCategoryBySlug(slug: string) {
  return prisma.category.findUnique({ where: { slug } });
}

export function findCategoryById(id: string) {
  return prisma.category.findUnique({ where: { id } });
}

export function createCategory(data: CreateCategoryInput) {
  return prisma.category.create({ data });
}

export function updateCategory(id: string, data: UpdateCategoryInput) {
  return prisma.category.update({ where: { id }, data });
}

export function deactivateCategory(id: string) {
  return prisma.category.update({ where: { id }, data: { isActive: false } });
}

export function countCategoryChildren(id: string) {
  return prisma.category.count({ where: { parentId: id, isActive: true } });
}

// ── Brands ─────────────────────────────────────────────────────────
export function findAllBrands() {
  return prisma.brand.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  });
}

export function findBrandById(id: string) {
  return prisma.brand.findUnique({ where: { id } });
}

export function createBrand(data: CreateBrandInput) {
  return prisma.brand.create({ data });
}

export function updateBrand(id: string, data: UpdateBrandInput) {
  return prisma.brand.update({ where: { id }, data });
}

export function deactivateBrand(id: string) {
  return prisma.brand.update({ where: { id }, data: { isActive: false } });
}

// ── Attributes ─────────────────────────────────────────────────────
export function findAllAttributes() {
  return prisma.attribute.findMany({
    orderBy: { name: 'asc' },
    include: attributeInclude,
  });
}

export function createAttributeWithValues(data: CreateAttributeInput) {
  return prisma.attribute.create({
    data: {
      name: data.name,
      values: { create: data.values.map((value) => ({ value })) },
    },
    include: attributeInclude,
  });
}

// ── Products ───────────────────────────────────────────────────────
export function findProducts(args: {
  where: Prisma.ProductWhereInput;
  orderBy: Prisma.ProductOrderByWithRelationInput;
  skip: number;
  take: number;
}) {
  return prisma.product.findMany({
    where: args.where,
    orderBy: args.orderBy,
    skip: args.skip,
    take: args.take,
    include: productListInclude,
  });
}

export function countProducts(where: Prisma.ProductWhereInput) {
  return prisma.product.count({ where });
}

export function findProductDetailBySlug(slug: string) {
  return prisma.product.findFirst({
    where: { slug, isActive: true },
    include: productDetailInclude,
  });
}

export function findFeaturedProducts(take: number) {
  return prisma.product.findMany({
    where: { isActive: true, isFeatured: true },
    orderBy: [{ rating: 'desc' }, { createdAt: 'desc' }],
    take,
    include: productListInclude,
  });
}

export function findRelatedProducts(
  categoryId: string,
  excludeProductId: string,
  take: number,
) {
  return prisma.product.findMany({
    where: {
      isActive: true,
      categoryId,
      id: { not: excludeProductId },
    },
    orderBy: [{ rating: 'desc' }, { createdAt: 'desc' }],
    take,
    include: productListInclude,
  });
}

export function findProductById(id: string) {
  return prisma.product.findUnique({ where: { id } });
}

export function createProduct(data: CreateProductInput) {
  const { variants, images, tags, brandId, ...rest } = data;
  // Unchecked create form: scalar categoryId/brandId + nested relation writes.
  return prisma.product.create({
    data: {
      ...rest,
      brandId: brandId ?? null,
      tags: tags ?? [],
      ...(variants && variants.length
        ? { variants: { create: variants } }
        : {}),
      ...(images && images.length ? { images: { create: images } } : {}),
    },
    include: productDetailInclude,
  });
}

export function updateProduct(id: string, data: UpdateProductInput) {
  return prisma.product.update({
    where: { id },
    data,
    include: productDetailInclude,
  });
}

export function softDeleteProduct(id: string) {
  return prisma.product.update({
    where: { id },
    data: { isActive: false },
  });
}

// ── Variants ───────────────────────────────────────────────────────
export function createVariant(productId: string, data: CreateVariantInput) {
  return prisma.productVariant.create({ data: { ...data, productId } });
}

export function findVariantById(id: string) {
  return prisma.productVariant.findUnique({ where: { id } });
}

export function updateVariant(id: string, data: UpdateVariantInput) {
  return prisma.productVariant.update({ where: { id }, data });
}

export function deleteVariant(id: string) {
  return prisma.productVariant.delete({ where: { id } });
}

// ── Images ─────────────────────────────────────────────────────────
export function createImage(productId: string, data: CreateImageInput) {
  return prisma.productImage.create({ data: { ...data, productId } });
}

export function findImageById(id: string) {
  return prisma.productImage.findUnique({ where: { id } });
}

export function deleteImage(id: string) {
  return prisma.productImage.delete({ where: { id } });
}
