/** Wishlist DTOs — kept module-local (no shared WishlistDTO exists yet). */
export interface WishlistItemDTO {
  id: string;
  productId: string;
  name: string;
  slug: string;
  image: string | null;
  pricePaise: number | null; // lowest active-variant price, or null if none purchasable
  addedAt: string;
}

export interface WishlistDTO {
  id: string;
  items: WishlistItemDTO[];
}
