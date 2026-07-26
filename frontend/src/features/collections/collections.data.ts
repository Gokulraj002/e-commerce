/**
 * Curated meal boxes — client-side hard-coded catalog for the
 * `/collections` feature.
 *
 * Each entry is a pre-portioned "everything you need for this meal" box:
 * one tap adds the whole set of underlying products to the cart. The shape
 * is a strict superset of the planned API response so components consuming
 * it will not need to change once the backend lands.
 *
 * TODO(backend): swap this array for a `useCollections()` React Query hook
 * once /api/v1/collections and /api/v1/collections/:slug are live. Each
 * box will map to a persisted CollectionDTO with real variantIds; the
 * bulk "add box" mutation will accept those variantIds directly.
 */

/** A single line-item inside a curated box. */
export interface CollectionItem {
  /**
   * Short human line the card renders as a chip and the detail-view table
   * renders as the item column, e.g. "Mutton curry cut · 1 kg".
   */
  label: string;
  /**
   * Grams per item. Used for the weight column on the detail view and,
   * eventually, for the bulk-add mutation payload once the backend maps
   * every collection item back to a real variant.
   */
  weightG: number;
}

/**
 * Editorial pill shown on the card and detail hero. Kept as a small
 * literal union so downstream components (badges/analytics) can `switch`
 * exhaustively.
 */
export type CollectionBadge =
  | "Chef's pick"
  | 'Best value'
  | 'Sunday special'
  | 'Weekend hero'
  | 'Premium';

/** A curated meal box surfaced on /collections and /collections/:slug. */
export interface Collection {
  id: string;
  /** URL-safe slug — the route param for the detail page. */
  slug: string;
  /** Editorial title (Playfair on the card + detail hero). */
  title: string;
  /** One-line editorial subhead shown under the title on the card. */
  tagline: string;
  /**
   * Longer paragraph shown as the lead copy on the detail page. Kept
   * short (≤ 60 words) so the layout stays scannable.
   */
  description: string;
  /** Selling price in whole rupees. Converted to paise via `rupeesToPaise`. */
  priceRupees: number;
  /**
   * Marked-up MRP in whole rupees; must be ≥ priceRupees. When strictly
   * greater, the card renders the strike-through + "Save ₹X" pill.
   */
  mrpRupees: number;
  /**
   * Editorial hero image. Currently a stable Unsplash CDN URL; will be
   * replaced by uploaded product photography once the backend lands.
   */
  imageUrl: string;
  /** 3–4 line items shown as chips on the card + rows on the detail page. */
  items: readonly CollectionItem[];
  /** Rough time-to-plate hint (mins) surfaced in the meta row. */
  cookTimeMinutes: number;
  /** How many humans the box comfortably feeds — surfaced in the meta row. */
  serves: number;
  /** Editorial pill (top-left of the card, top of the detail hero). */
  badge: CollectionBadge;
}

const IMG = (id: string): string =>
  // Stable Unsplash CDN — no API key required. Sized down for card use.
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1400&q=80`;

/**
 * The six flagship boxes. Ordered so the two most universal meals
 * (Sunday biryani, weekend BBQ) lead, followed by regional and
 * lifestyle picks.
 */
export const COLLECTIONS: readonly Collection[] = [
  {
    id: 'col_sunday_biryani',
    slug: 'sunday-biryani-box',
    title: 'Sunday biryani box',
    tagline: 'The one that makes Sundays smell like grandma’s kitchen.',
    description:
      'Everything you need for a slow-cooked dum biryani for six — aged mutton on the bone, tender boneless chicken to layer, and our house-ground biryani masala portioned exactly to the pot. No guesswork, no last-minute runs to the market.',
    priceRupees: 1499,
    mrpRupees: 1799,
    imageUrl: IMG('1633945274309-2c16c9660e15'),
    items: [
      { label: 'Mutton curry cut · 1 kg', weightG: 1000 },
      { label: 'Chicken boneless · 500 g', weightG: 500 },
      { label: 'House biryani spice · 50 g', weightG: 50 },
    ],
    cookTimeMinutes: 90,
    serves: 6,
    badge: 'Sunday special',
  },
  {
    id: 'col_weekend_bbq',
    slug: 'weekend-bbq-pack',
    title: 'Weekend BBQ pack',
    tagline: 'Fire up the grill — every cut a crowd-pleaser.',
    description:
      'A trio of the best-loved grilling cuts, portioned for a family cookout. Marinate on Friday, sear on Saturday. Antibiotic-free birds, hand-trimmed by our butchers so nothing sticks or shrivels on the grill.',
    priceRupees: 1099,
    mrpRupees: 1349,
    imageUrl: IMG('1544025162-d76694265947'),
    items: [
      { label: 'Chicken wings · 500 g', weightG: 500 },
      { label: 'Chicken drumsticks · 500 g', weightG: 500 },
      { label: 'Chicken boneless · 500 g', weightG: 500 },
    ],
    cookTimeMinutes: 45,
    serves: 5,
    badge: 'Weekend hero',
  },
  {
    id: 'col_kerala_fish_curry',
    slug: 'kerala-fish-curry-kit',
    title: 'Kerala fish curry kit',
    tagline: 'Coastal, tangy, unmistakably meen curry.',
    description:
      'Two coast-favourites in one box — freshwater rohu curry-cut and plump king prawns — chilled on ice and cleaned in-house. Add coconut, kokum and curry leaves; dinner writes itself.',
    priceRupees: 899,
    mrpRupees: 1049,
    imageUrl: IMG('1626804475297-41608ea09aeb'),
    items: [
      { label: 'Rohu curry cut · 500 g', weightG: 500 },
      { label: 'King prawns · 250 g', weightG: 250 },
    ],
    cookTimeMinutes: 35,
    serves: 4,
    badge: "Chef's pick",
  },
  {
    id: 'col_protein_hero',
    slug: 'protein-hero-pack',
    title: 'Protein hero pack',
    tagline: 'A week of clean, lean fuel.',
    description:
      'Built for the gym crowd — a kilo of skinless boneless chicken breast plus a dozen farm-fresh eggs, portioned to see you through five prep-day meals. Antibiotic-free, cold-chain sealed.',
    priceRupees: 749,
    mrpRupees: 899,
    imageUrl: IMG('1587593810167-a84920ea0781'),
    items: [
      { label: 'Chicken boneless breast · 1 kg', weightG: 1000 },
      { label: 'Farm-fresh eggs · 12 ct', weightG: 720 },
    ],
    cookTimeMinutes: 20,
    serves: 5,
    badge: 'Best value',
  },
  {
    id: 'col_kadaknath',
    slug: 'kadaknath-premium',
    title: 'Kadaknath premium',
    tagline: 'Single-source dark meat, prized for its depth.',
    description:
      'Pure Kadaknath — the ink-dark heritage bird from Jhabua. Denser, richer, and slower-grown than a broiler. One kilo, curry-cut, ready to marinate and slow-braise the way it deserves.',
    priceRupees: 1299,
    mrpRupees: 1499,
    imageUrl: IMG('1610057099443-fde8c4d50f91'),
    items: [{ label: 'Kadaknath whole · 1 kg curry cut', weightG: 1000 }],
    cookTimeMinutes: 75,
    serves: 4,
    badge: 'Premium',
  },
  {
    id: 'col_party_feast',
    slug: 'party-feast',
    title: 'Party feast',
    tagline: 'One box, eight guests, three showstoppers.',
    description:
      'Hosting? Skip the four separate orders. A whole tender chicken, mutton curry-cut for the biryani pot, and a pack of prawns for the starter — all portioned for a proper dinner party of eight.',
    priceRupees: 2299,
    mrpRupees: 2749,
    imageUrl: IMG('1567620832903-9fc6debc209f'),
    items: [
      { label: 'Whole chicken · 1.2 kg', weightG: 1200 },
      { label: 'Mutton curry cut · 750 g', weightG: 750 },
      { label: 'King prawns · 300 g', weightG: 300 },
    ],
    cookTimeMinutes: 120,
    serves: 8,
    badge: 'Best value',
  },
];

/** Lookup helper the detail page uses to resolve `:slug` → box. */
export function findCollectionBySlug(slug: string): Collection | undefined {
  return COLLECTIONS.find((c) => c.slug === slug);
}
