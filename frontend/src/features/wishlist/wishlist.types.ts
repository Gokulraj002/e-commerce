/**
 * Wishlist DTOs. The backend keeps these module-local (there is no shared
 * `WishlistDTO`), so we mirror the shapes here for the client.
 */
export interface WishlistItemDTO {
  id: string;
  productId: string;
  name: string;
  slug: string;
  image: string | null;
  /** Lowest active-variant price in paise, or null when nothing is purchasable. */
  pricePaise: number | null;
  addedAt: string;
}

export interface WishlistDTO {
  id: string;
  items: WishlistItemDTO[];
}
