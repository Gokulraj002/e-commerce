import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getApiErrorMessage } from '@/lib/apiClient';
import { useToast } from '@/components/ui';

import * as catalogApi from './catalog.api';
import type { AdminProductQuery, FlatCategory } from './catalog.api';
import type { ProductDetailDTO } from './catalog.types';
import type {
  AttributeFormValues,
  BrandFormValues,
  CategoryFormValues,
  ProductFormValues,
} from './catalog.schema';

/** Shared query-key roots so mutations can invalidate the right lists. */
export const catalogKeys = {
  products: ['catalog', 'products'] as const,
  product: (slug: string) => ['catalog', 'product', slug] as const,
  categories: ['catalog', 'categories'] as const,
  brands: ['catalog', 'brands'] as const,
  attributes: ['catalog', 'attributes'] as const,
};

// ── Products ───────────────────────────────────────────────────────
export function useAdminProducts(query: AdminProductQuery) {
  return useQuery({
    queryKey: [...catalogKeys.products, query],
    queryFn: () => catalogApi.listAdminProducts(query),
  });
}

export function useProduct(slug: string | undefined) {
  return useQuery({
    queryKey: catalogKeys.product(slug ?? ''),
    queryFn: () => catalogApi.getProductBySlug(slug as string),
    enabled: Boolean(slug),
  });
}

export function useCreateProduct() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (values: ProductFormValues) => catalogApi.saveProduct(values),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: catalogKeys.products });
      toast.success({ title: 'Product created' });
    },
    onError: (err) => toast.error({ title: 'Could not create product', message: getApiErrorMessage(err) }),
  });
}

export function useUpdateProduct() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ values, existing }: { values: ProductFormValues; existing: ProductDetailDTO }) =>
      catalogApi.saveProduct(values, existing),
    onSuccess: (product) => {
      qc.invalidateQueries({ queryKey: catalogKeys.products });
      qc.invalidateQueries({ queryKey: catalogKeys.product(product.slug) });
      toast.success({ title: 'Product updated' });
    },
    onError: (err) => toast.error({ title: 'Could not save product', message: getApiErrorMessage(err) }),
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (id: string) => catalogApi.deleteProduct(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: catalogKeys.products });
      toast.success({ title: 'Product deleted' });
    },
    onError: (err) => toast.error({ title: 'Could not delete product', message: getApiErrorMessage(err) }),
  });
}

/** Toggle a product's active flag — used by the bulk-actions rail. */
export function useSetProductActive() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      catalogApi.setProductActive(id, isActive),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: catalogKeys.products });
    },
    onError: (err) =>
      toast.error({ title: 'Could not update status', message: getApiErrorMessage(err) }),
  });
}

// ── Categories ─────────────────────────────────────────────────────
export function useCategories() {
  return useQuery({
    queryKey: catalogKeys.categories,
    queryFn: () => catalogApi.getCategoryTree(),
    select: (tree): FlatCategory[] => catalogApi.flattenCategories(tree),
  });
}

export function useSaveCategory() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ id, values }: { id?: string; values: CategoryFormValues }) =>
      id ? catalogApi.updateCategory(id, values) : catalogApi.createCategory(values),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: catalogKeys.categories });
      toast.success({ title: variables.id ? 'Category updated' : 'Category created' });
    },
    onError: (err) => toast.error({ title: 'Could not save category', message: getApiErrorMessage(err) }),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (id: string) => catalogApi.deleteCategory(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: catalogKeys.categories });
      toast.success({ title: 'Category deleted' });
    },
    onError: (err) => toast.error({ title: 'Could not delete category', message: getApiErrorMessage(err) }),
  });
}

// ── Brands ─────────────────────────────────────────────────────────
export function useBrands() {
  return useQuery({
    queryKey: catalogKeys.brands,
    queryFn: () => catalogApi.getBrands(),
  });
}

export function useSaveBrand() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: ({ id, values }: { id?: string; values: BrandFormValues }) =>
      id ? catalogApi.updateBrand(id, values) : catalogApi.createBrand(values),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: catalogKeys.brands });
      toast.success({ title: variables.id ? 'Brand updated' : 'Brand created' });
    },
    onError: (err) => toast.error({ title: 'Could not save brand', message: getApiErrorMessage(err) }),
  });
}

export function useDeleteBrand() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (id: string) => catalogApi.deleteBrand(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: catalogKeys.brands });
      toast.success({ title: 'Brand deleted' });
    },
    onError: (err) => toast.error({ title: 'Could not delete brand', message: getApiErrorMessage(err) }),
  });
}

// ── Attributes ─────────────────────────────────────────────────────
export function useAttributes() {
  return useQuery({
    queryKey: catalogKeys.attributes,
    queryFn: () => catalogApi.getAttributes(),
  });
}

export function useCreateAttribute() {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (values: AttributeFormValues) => catalogApi.createAttribute(values),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: catalogKeys.attributes });
      toast.success({ title: 'Attribute created' });
    },
    onError: (err) => toast.error({ title: 'Could not create attribute', message: getApiErrorMessage(err) }),
  });
}
