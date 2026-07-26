import type { Request, Response } from 'express';

import { created, ok } from '../../utils/http.js';
import * as service from './catalog.service.js';
import type {
  CreateAttributeInput,
  CreateBrandInput,
  CreateCategoryInput,
  CreateImageInput,
  CreateProductInput,
  CreateVariantInput,
  ProductListQuery,
  UpdateBrandInput,
  UpdateCategoryInput,
  UpdateProductInput,
  UpdateVariantInput,
} from './catalog.schema.js';

/**
 * Thin controllers: pull validated input off the request, call the service,
 * shape the HTTP response. No business logic, no Prisma.
 */

// ── Categories ─────────────────────────────────────────────────────
export async function getCategoryTree(_req: Request, res: Response) {
  return ok(res, await service.getCategoryTree());
}

export async function getCategory(req: Request, res: Response) {
  return ok(res, await service.getCategoryBySlug(req.params.slug));
}

export async function createCategory(req: Request, res: Response) {
  return created(res, await service.createCategory(req.body as CreateCategoryInput));
}

export async function updateCategory(req: Request, res: Response) {
  return ok(res, await service.updateCategory(req.params.id, req.body as UpdateCategoryInput));
}

export async function deleteCategory(req: Request, res: Response) {
  await service.deleteCategory(req.params.id);
  return ok(res, { id: req.params.id }, 'Category deleted');
}

// ── Brands ─────────────────────────────────────────────────────────
export async function getBrands(_req: Request, res: Response) {
  return ok(res, await service.getBrands());
}

export async function createBrand(req: Request, res: Response) {
  return created(res, await service.createBrand(req.body as CreateBrandInput));
}

export async function updateBrand(req: Request, res: Response) {
  return ok(res, await service.updateBrand(req.params.id, req.body as UpdateBrandInput));
}

export async function deleteBrand(req: Request, res: Response) {
  await service.deleteBrand(req.params.id);
  return ok(res, { id: req.params.id }, 'Brand deleted');
}

// ── Attributes ─────────────────────────────────────────────────────
export async function getAttributes(_req: Request, res: Response) {
  return ok(res, await service.getAttributes());
}

export async function createAttribute(req: Request, res: Response) {
  return created(res, await service.createAttribute(req.body as CreateAttributeInput));
}

// ── Products ───────────────────────────────────────────────────────
export async function listProducts(req: Request, res: Response) {
  return ok(res, await service.listProducts(req.query as unknown as ProductListQuery));
}

export async function getFeatured(_req: Request, res: Response) {
  return ok(res, await service.getFeaturedProducts());
}

export async function getRelated(req: Request, res: Response) {
  return ok(res, await service.getRelatedProducts(req.params.slug));
}

export async function getProduct(req: Request, res: Response) {
  return ok(res, await service.getProductBySlug(req.params.slug));
}

export async function createProduct(req: Request, res: Response) {
  return created(res, await service.createProduct(req.body as CreateProductInput));
}

export async function updateProduct(req: Request, res: Response) {
  return ok(res, await service.updateProduct(req.params.id, req.body as UpdateProductInput));
}

export async function deleteProduct(req: Request, res: Response) {
  await service.deleteProduct(req.params.id);
  return ok(res, { id: req.params.id }, 'Product deleted');
}

// ── Variants ───────────────────────────────────────────────────────
export async function addVariant(req: Request, res: Response) {
  return created(res, await service.addVariant(req.params.id, req.body as CreateVariantInput));
}

export async function updateVariant(req: Request, res: Response) {
  return ok(
    res,
    await service.updateVariant(
      req.params.id,
      req.params.variantId,
      req.body as UpdateVariantInput,
    ),
  );
}

export async function deleteVariant(req: Request, res: Response) {
  await service.removeVariant(req.params.id, req.params.variantId);
  return ok(res, { id: req.params.variantId }, 'Variant deleted');
}

// ── Images ─────────────────────────────────────────────────────────
export async function addImage(req: Request, res: Response) {
  return created(res, await service.addImage(req.params.id, req.body as CreateImageInput));
}

export async function deleteImage(req: Request, res: Response) {
  await service.removeImage(req.params.id, req.params.imageId);
  return ok(res, { id: req.params.imageId }, 'Image deleted');
}
