/** Barrel for the catalog feature — hooks, API, types and shared components. */
export * from './catalog.api';
export * from './catalog.types';
export * from './useCatalog';
export * from './productHelpers';
export { ProductCard, type ProductCardProps } from './components/ProductCard';
export { ImageGallery, type ImageGalleryProps } from './components/ImageGallery';
export {
  RelatedProductsRail,
  type RelatedProductsRailProps,
} from './components/RelatedProductsRail';
export {
  RecentlyViewed,
  rememberViewedProduct,
  type RecentlyViewedProps,
} from './components/RecentlyViewed';
export { useOnScreen, type UseOnScreenOptions } from './hooks/useOnScreen';
