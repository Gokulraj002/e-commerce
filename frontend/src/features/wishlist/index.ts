/** Barrel for the wishlist feature — hooks, API and types. */
export * from './wishlist.api';
export * from './wishlist.types';
export {
  WISHLIST_QUERY_KEY,
  useWishlist,
  useAddToWishlist,
  useRemoveFromWishlist,
  useMoveToCart,
} from './useWishlist';
export { HeartBurst, type HeartBurstProps } from './HeartBurst';
