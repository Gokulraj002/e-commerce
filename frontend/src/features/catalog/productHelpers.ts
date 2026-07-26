/** Pure helpers for deriving display values from a ProductDTO's variants. */
import type { ProductDTO, ProductVariantDTO } from '@elite/shared';

/**
 * The cheapest variant by selling price — the one a product tile advertises.
 * Returns `null` for a product with no variants (defensive; the API always
 * returns at least one for an active product).
 */
export function cheapestVariant(product: ProductDTO): ProductVariantDTO | null {
  if (product.variants.length === 0) return null;
  return product.variants.reduce((lowest, v) =>
    v.pricePaise < lowest.pricePaise ? v : lowest,
  );
}

/** Whether any variant of the product can currently be bought. */
export function isProductInStock(product: ProductDTO): boolean {
  return product.variants.some((v) => v.inStock);
}
