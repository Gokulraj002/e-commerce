/**
 * Static navigation categories for the header mega-menu.
 * Placeholder until the catalog category API is wired up; the next agent can
 * swap this for a `useQuery(['categories'])` fed from `/catalog/categories`.
 */
export interface NavCategory {
  slug: string;
  name: string;
  emoji: string;
  blurb: string;
}

export const NAV_CATEGORIES: NavCategory[] = [
  { slug: 'chicken', name: 'Chicken', emoji: '🍗', blurb: 'Curry cuts, boneless, wings & more' },
  { slug: 'mutton', name: 'Mutton', emoji: '🥩', blurb: 'Curry cut, biryani cut, mince' },
  { slug: 'seafood', name: 'Seafood', emoji: '🦐', blurb: 'Prawns, fish fillets & crab' },
  { slug: 'eggs', name: 'Eggs', emoji: '🥚', blurb: 'Farm, country & free-range' },
  { slug: 'ready-to-cook', name: 'Ready to Cook', emoji: '🔥', blurb: 'Marinated & kebab-ready' },
];
