/**
 * Recipe catalogue — client-side only.
 *
 * Product slug → up to 3 curated recipe stubs. The stubs are lightweight
 * editorial content (title, cover photo, cook-time, difficulty, ingredients,
 * numbered steps) so the PDP can render inspiring "cook this tonight" cards
 * without a network round-trip.
 *
 * Content strategy: prefer a slug-specific mapping so a shopper on
 * `chicken-biryani-cut` sees biryani ideas rather than a generic fry-up.
 * Products that are not mapped fall back to a generic trio that reads well
 * for any cut of meat.
 *
 * TODO(cms): move this static map into the CMS (admin-authored recipe
 * collections joined to products) so marketing can iterate without a code
 * deploy. Kept intentionally simple for now — no i18n, no localisation.
 */

/** Difficulty tier surfaced as a small chip on each recipe card. */
export type RecipeDifficulty = 'Easy' | 'Medium' | 'Advanced';

/** A single recipe stub — the shape rendered by `RecipeCard` and `RecipeModal`. */
export interface Recipe {
  /** Stable id used as the React key and modal identifier. */
  id: string;
  /** Editorial title (Playfair on the card, sentence caps). */
  title: string;
  /** Cover image URL (Unsplash food photo). */
  image: string;
  /** Total cook time chip, e.g. "25 min", "1 hr 15 min". */
  cookTime: string;
  /** Difficulty chip — Easy / Medium / Advanced. */
  difficulty: RecipeDifficulty;
  /** One-line editorial intro shown at the top of the modal. */
  intro: string;
  /** Bulleted ingredient list. Shopper-friendly quantities. */
  ingredients: readonly string[];
  /** Ordered cooking steps — numbered by the UI. */
  steps: readonly string[];
}

// ─────────────────────────────────────────────────────────────
// Fallback recipes — used when a product slug isn't specifically
// mapped in `RECIPES_BY_SLUG`. The three fallbacks map to the
// briefs from the PDP spec: "Simple pan-fry", "Curry with coconut",
// "Marinated grill".
// ─────────────────────────────────────────────────────────────

const FALLBACK_PAN_FRY: Recipe = {
  id: 'fallback-pan-fry',
  title: 'Simple pan-fry',
  image:
    'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=900&q=80',
  cookTime: '20 min',
  difficulty: 'Easy',
  intro:
    'A weeknight-friendly pan-fry that lets the cut do the talking — a hot pan, salt, pepper, a whisper of ghee.',
  ingredients: [
    '500 g cut of your choice, patted dry',
    '2 tsp ghee or neutral oil',
    '1 tsp black pepper, freshly cracked',
    '1½ tsp sea salt',
    '2 sprigs curry leaves',
    '1 green chilli, slit lengthwise',
    'Juice of ½ lemon, to finish',
  ],
  steps: [
    'Bring the meat to room temperature for 10 minutes. Pat it dry — a dry surface is what gives you a proper sear.',
    'Season generously with salt and cracked pepper. Rest for 5 minutes so the salt draws out moisture.',
    'Heat ghee in a heavy pan until it shimmers. Lay the pieces down and leave them undisturbed for 2 minutes to build a crust.',
    'Flip once, add curry leaves and slit chilli, and cook the second side for 2–3 minutes.',
    'Rest off the heat for 3 minutes, finish with a squeeze of lemon and serve hot.',
  ],
};

const FALLBACK_COCONUT_CURRY: Recipe = {
  id: 'fallback-coconut-curry',
  title: 'Curry with coconut',
  image:
    'https://images.unsplash.com/photo-1567337710282-00832b415979?auto=format&fit=crop&w=900&q=80',
  cookTime: '45 min',
  difficulty: 'Medium',
  intro:
    'A gentle south-coast curry — bloomed spices, fresh coconut milk, and a slow simmer that keeps the meat succulent.',
  ingredients: [
    '750 g cut of your choice',
    '2 medium onions, finely sliced',
    '1 tbsp ginger-garlic paste',
    '2 tomatoes, chopped',
    '1 tsp turmeric, 2 tsp red chilli powder, 1 tbsp coriander powder',
    '1 tsp garam masala',
    '400 ml coconut milk',
    'Curry leaves, mustard seeds, oil, salt to taste',
  ],
  steps: [
    'Marinate the meat with turmeric, chilli, salt and a splash of oil for 15 minutes.',
    'Splutter mustard seeds and curry leaves in oil. Add onions and sauté until deep golden — patience here builds the base flavour.',
    'Stir in the ginger-garlic paste, cook for a minute, then add tomatoes and the ground spices. Cook until the oil separates.',
    'Add the marinated meat and sear for 4 minutes on high heat to lock in the juices.',
    'Pour in the coconut milk, bring to a whisper, cover and simmer 25–30 minutes until fork-tender.',
    'Finish with garam masala, rest 5 minutes off the heat, and serve with rice or appam.',
  ],
};

const FALLBACK_GRILL: Recipe = {
  id: 'fallback-grill',
  title: 'Marinated grill',
  image:
    'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=900&q=80',
  cookTime: '35 min + marinade',
  difficulty: 'Medium',
  intro:
    'A yogurt-and-spice marinade tenderises overnight — then it is nothing but a hot grill and smoky char.',
  ingredients: [
    '600 g cut of your choice, in bite-sized pieces',
    '3 tbsp thick yogurt, hung',
    '1 tbsp ginger-garlic paste',
    '1 tsp Kashmiri chilli, ½ tsp turmeric, 1 tsp cumin',
    '1 tbsp mustard oil',
    'Juice of 1 lemon, salt to taste',
    'Sliced onions and lemon wedges, to serve',
  ],
  steps: [
    'Whisk yogurt with ginger-garlic, spices, mustard oil, lemon and salt. Add the meat and coat every piece.',
    'Cover and marinate in the fridge for at least 4 hours, ideally overnight.',
    'Bring to room temperature 20 minutes before cooking so the outside can char without leaving a cold centre.',
    'Skewer or lay on a hot grill / cast-iron pan. Cook 3–4 minutes per side, brushing with a little extra mustard oil.',
    'Rest 5 minutes, serve on a bed of sliced onions with lemon wedges and a green chutney.',
  ],
};

const FALLBACK: readonly Recipe[] = [FALLBACK_PAN_FRY, FALLBACK_COCONUT_CURRY, FALLBACK_GRILL];

// ─────────────────────────────────────────────────────────────
// Slug-specific mappings. Only need to name the recipes that
// deviate from the fallback set — anything unmapped inherits it.
// Kept tight (max 3 per product) so the rail always fits on screen.
// ─────────────────────────────────────────────────────────────

const BIRYANI: Recipe = {
  id: 'biryani',
  title: 'Hyderabadi dum biryani',
  image:
    'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=900&q=80',
  cookTime: '1 hr 30 min',
  difficulty: 'Advanced',
  intro:
    'The classic Hyderabadi kacchi — raw marinated meat layered under parboiled rice and cooked on dum until each grain is perfumed.',
  ingredients: [
    '1 kg biryani cut, on the bone',
    '500 g basmati rice, soaked 30 minutes',
    '1 cup thick yogurt, hung',
    '3 large onions, deep-fried until golden (birista)',
    '1 tbsp ginger-garlic paste',
    'Whole spices: 2 bay leaves, 4 cloves, 4 green cardamom, 1 black cardamom, 1" cinnamon',
    '1 tsp Kashmiri chilli, ½ tsp turmeric, 1 tbsp biryani masala',
    'Fresh mint and coriander leaves, 3 tbsp ghee',
    'A pinch of saffron in ¼ cup warm milk',
  ],
  steps: [
    'Marinate the meat with yogurt, half the birista, ginger-garlic, chilli, turmeric, masala, mint, coriander and salt. Rest for 45 minutes.',
    'Boil water with whole spices and salt. Add the drained rice, cook until 70% done, then drain immediately.',
    'Layer the marinated meat at the bottom of a heavy pot. Top with parboiled rice, remaining birista, saffron milk and ghee.',
    'Seal the lid tight with dough or a heavy weight. Cook on high heat for 4 minutes, then on the lowest flame for 40 minutes.',
    'Rest 10 minutes off the heat before opening. Serve gently mixed, with mirchi ka salan and raita.',
  ],
};

const CHICKEN_65: Recipe = {
  id: 'chicken-65',
  title: 'Chicken 65',
  image:
    'https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?auto=format&fit=crop&w=900&q=80',
  cookTime: '30 min',
  difficulty: 'Medium',
  intro:
    'The Chennai bar-and-restaurant favourite — twice-cooked chicken with curry leaves, a red hot marinade and a squeeze of lime.',
  ingredients: [
    '500 g boneless chicken, cubed',
    '2 tbsp yogurt, 1 tbsp ginger-garlic paste',
    '2 tsp Kashmiri chilli, ½ tsp turmeric, 1 tsp garam masala',
    '2 tbsp cornflour, 1 tbsp rice flour',
    'A large sprig of curry leaves',
    '3 green chillies, slit',
    'Oil for shallow-frying, salt and lemon to finish',
  ],
  steps: [
    'Marinate the chicken with yogurt, ginger-garlic, chilli, turmeric, garam masala, salt, cornflour and rice flour. Rest 20 minutes.',
    'Shallow-fry in batches over medium-high heat for 3–4 minutes until crisp on the outside and just cooked through.',
    'In a fresh pan, sizzle curry leaves and slit chillies in a tablespoon of oil until fragrant.',
    'Toss the fried chicken through until every piece is glossed with the tempering.',
    'Finish with a squeeze of lemon and serve immediately — 65 waits for no one.',
  ],
};

const BUTTER_CHICKEN: Recipe = {
  id: 'butter-chicken',
  title: 'Butter chicken (murgh makhani)',
  image:
    'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=900&q=80',
  cookTime: '55 min',
  difficulty: 'Medium',
  intro:
    'A silky tomato-butter gravy with charred tandoori chicken — the Punjabi classic that every kitchen should know by heart.',
  ingredients: [
    '600 g boneless chicken, cubed',
    '3 tbsp yogurt, 1 tbsp ginger-garlic paste',
    '1 tsp Kashmiri chilli, ½ tsp garam masala',
    '500 g ripe tomatoes, roughly chopped',
    '2 tbsp butter + 1 tbsp oil, 1 tbsp cashews',
    '100 ml fresh cream',
    '1 tsp kasuri methi, crushed',
    'Salt, sugar and a knob of butter to finish',
  ],
  steps: [
    'Marinate the chicken with yogurt, ginger-garlic, chilli and half the garam masala for 30 minutes.',
    'Simmer tomatoes with cashews and 200 ml water for 15 minutes, cool and blend to a velvety purée. Strain if you want it silk-smooth.',
    'Grill or pan-sear the marinated chicken over high heat for 4 minutes a side to develop char.',
    'Melt butter with oil, tip in the tomato purée and cook for 6–8 minutes until deepened. Season with salt and a pinch of sugar.',
    'Add the seared chicken and simmer 10 minutes, then finish with cream, kasuri methi and the last knob of butter.',
    'Rest 5 minutes off the heat and serve with naan or steamed basmati.',
  ],
};

const MUTTON_ROGAN: Recipe = {
  id: 'mutton-rogan-josh',
  title: 'Kashmiri rogan josh',
  image:
    'https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=900&q=80',
  cookTime: '2 hr',
  difficulty: 'Advanced',
  intro:
    'Deep red, aromatic, and slow-cooked — Kashmiri chillies bring the colour, ratanjot brings the glow, and time does the rest.',
  ingredients: [
    '1 kg mutton on the bone, cut for curry',
    '3 tbsp mustard oil, 2 tbsp ghee',
    '2 large onions, ground to a paste',
    '½ cup thick yogurt, whisked',
    'Whole spices: 2 bay leaves, 4 cloves, 4 cardamom, 1 black cardamom, 2 mace, 1" cinnamon',
    '1 tbsp Kashmiri chilli powder, ½ tsp turmeric',
    '1 tsp fennel powder, 1 tsp ginger powder',
    'Salt to taste',
  ],
  steps: [
    'Heat mustard oil to smoking, cool slightly, then add whole spices and let them sizzle.',
    'Add the mutton and sear on high heat for 8 minutes until every piece is deeply browned.',
    'Stir in onion paste and cook for 6–8 minutes until it turns a rich caramel colour.',
    'Reduce the heat and whisk in the yogurt a spoon at a time so it does not split. Add Kashmiri chilli, turmeric, fennel and ginger powder.',
    'Pour in 500 ml hot water, cover tight and simmer on the lowest flame for 60–75 minutes until the meat is fall-off-the-bone.',
    'Uncover, reduce the gravy for 5 more minutes, finish with ghee and serve with steamed rice.',
  ],
};

const MUTTON_CURRY: Recipe = {
  id: 'andhra-mutton',
  title: 'Andhra mutton curry',
  image:
    'https://images.unsplash.com/photo-1574484284002-952d92456975?auto=format&fit=crop&w=900&q=80',
  cookTime: '1 hr 30 min',
  difficulty: 'Medium',
  intro:
    'Fiery, coriander-forward and finished with a coconut-poppy paste — the coastal Andhra style that pairs with hot ragi mudde.',
  ingredients: [
    '750 g mutton curry cut',
    '3 tbsp coconut oil',
    '2 onions sliced, 3 tomatoes chopped',
    '1 tbsp ginger-garlic paste',
    '2 tbsp coriander powder, 1 tbsp chilli powder, ½ tsp turmeric',
    '2 tbsp grated coconut + 1 tbsp poppy seeds, ground to a paste',
    'Whole spices, curry leaves, salt',
  ],
  steps: [
    'Sear the mutton on high heat in coconut oil for 5 minutes until it takes on colour. Lift and set aside.',
    'In the same pot, sauté onions with whole spices and curry leaves until deeply browned.',
    'Add ginger-garlic and tomatoes, cook until the fat rises. Stir in coriander, chilli and turmeric.',
    'Return the mutton, add 1 litre hot water, cover and pressure-cook for 4 whistles (or simmer 75 minutes).',
    'Open the pot, stir in the coconut-poppy paste and simmer uncovered for 10 minutes to thicken.',
    'Finish with fresh curry leaves and serve hot with rice or ragi mudde.',
  ],
};

const PRAWN_CURRY: Recipe = {
  id: 'prawn-curry',
  title: 'Coastal prawn curry',
  image:
    'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&w=900&q=80',
  cookTime: '30 min',
  difficulty: 'Easy',
  intro:
    'A bright coconut curry that comes together in the time it takes rice to steam — perfect for a weeknight sea supper.',
  ingredients: [
    '500 g cleaned prawns',
    '1 onion finely chopped, 2 tomatoes puréed',
    '1 tsp mustard seeds, sprig of curry leaves',
    '1 tbsp ginger-garlic paste',
    '1 tsp turmeric, 1 tbsp Kashmiri chilli, 1 tbsp coriander powder',
    '200 ml coconut milk',
    '1 tsp tamarind pulp, salt to taste',
  ],
  steps: [
    'Marinate the prawns with a pinch of turmeric and salt for 10 minutes.',
    'Splutter mustard seeds in oil, add curry leaves and onion, sauté until soft.',
    'Stir in ginger-garlic, then the tomato purée and ground spices. Cook until oil separates.',
    'Pour in the coconut milk with tamarind and bring to a gentle simmer.',
    'Slide in the prawns and cook for 3–4 minutes only — any longer and they toughen.',
    'Rest 2 minutes off the heat and serve with steamed rice.',
  ],
};

const FISH_FRY: Recipe = {
  id: 'fish-fry',
  title: 'Coastal fish fry',
  image:
    'https://images.unsplash.com/photo-1611270629569-8b357cb88da9?auto=format&fit=crop&w=900&q=80',
  cookTime: '25 min',
  difficulty: 'Easy',
  intro:
    'A rava-crusted, chilli-red fish fry — the kind served on banana leaves along the Konkan coast.',
  ingredients: [
    '4 steaks of firm fish',
    '2 tbsp Kashmiri chilli powder, ½ tsp turmeric',
    '1 tbsp ginger-garlic paste, juice of ½ lemon',
    'Salt to taste',
    '4 tbsp fine rava (semolina)',
    'Coconut oil, to shallow-fry',
    'Curry leaves and lemon wedges, to serve',
  ],
  steps: [
    'Make a paste of chilli, turmeric, ginger-garlic, lemon and salt. Coat the fish and rest for 15 minutes.',
    'Spread rava on a plate and press each steak into it, coating both sides evenly.',
    'Heat coconut oil in a heavy pan. Lay the fish down and cook 3 minutes without moving it.',
    'Flip once, drop in curry leaves, and cook the other side for 2–3 minutes until golden and crisp.',
    'Drain on paper, serve immediately with a squeeze of lemon.',
  ],
};

const KEEMA_PAV: Recipe = {
  id: 'keema-pav',
  title: 'Mumbai keema pav',
  image:
    'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=900&q=80',
  cookTime: '40 min',
  difficulty: 'Easy',
  intro:
    'The classic Irani-cafe breakfast — spiced minced meat that soaks the pav in ghee-buttered comfort.',
  ingredients: [
    '500 g fresh keema',
    '2 onions finely chopped, 3 tomatoes puréed',
    '2 green chillies, 1 tbsp ginger-garlic paste',
    '1 tsp turmeric, 1 tbsp chilli, 1 tsp garam masala',
    '½ cup fresh peas',
    'Ghee, coriander to finish',
    'Pav (soft dinner rolls), to serve',
  ],
  steps: [
    'Melt ghee, add onions and cook until deeply browned — 8 minutes patient work.',
    'Stir in ginger-garlic and green chillies, then the tomato purée and ground spices. Cook until oil separates.',
    'Add the keema and break it up with a wooden spoon, sear on high heat for 5 minutes.',
    'Add peas and 200 ml water, cover and simmer 15 minutes until thick and spoonable.',
    'Finish with garam masala and coriander. Split hot pav, smear with ghee and toast on a tawa.',
    'Serve keema alongside the toasted pav, with a wedge of lime and sliced onions.',
  ],
};

// ─────────────────────────────────────────────────────────────
// Product → recipes mapping. Kept as a plain object so it tree-
// shakes cleanly and TS can widen the keys naturally at the
// call site.
// ─────────────────────────────────────────────────────────────
const RECIPES_BY_SLUG: Readonly<Record<string, readonly Recipe[]>> = {
  // Poultry
  'chicken-curry-cut': [BUTTER_CHICKEN, CHICKEN_65, FALLBACK_COCONUT_CURRY],
  'boneless-chicken': [BUTTER_CHICKEN, CHICKEN_65, FALLBACK_GRILL],
  'chicken-biryani-cut': [BIRYANI, BUTTER_CHICKEN, FALLBACK_COCONUT_CURRY],
  'chicken-wings': [FALLBACK_GRILL, CHICKEN_65, FALLBACK_PAN_FRY],
  'chicken-drumsticks': [FALLBACK_GRILL, BUTTER_CHICKEN, CHICKEN_65],
  'chicken-liver': [FALLBACK_PAN_FRY, FALLBACK_COCONUT_CURRY, FALLBACK_GRILL],
  'country-chicken': [FALLBACK_COCONUT_CURRY, BIRYANI, FALLBACK_PAN_FRY],
  'kadaknath-chicken': [FALLBACK_COCONUT_CURRY, FALLBACK_PAN_FRY, FALLBACK_GRILL],
  'quail': [FALLBACK_GRILL, FALLBACK_PAN_FRY, FALLBACK_COCONUT_CURRY],
  // Mutton
  'mutton-curry-cut': [MUTTON_ROGAN, MUTTON_CURRY, BIRYANI],
  'mutton-boneless': [MUTTON_ROGAN, KEEMA_PAV, FALLBACK_GRILL],
  'mutton-chops': [FALLBACK_GRILL, MUTTON_ROGAN, FALLBACK_PAN_FRY],
  'mutton-keema': [KEEMA_PAV, FALLBACK_PAN_FRY, MUTTON_CURRY],
  // Seafood
  'prawns': [PRAWN_CURRY, FISH_FRY, FALLBACK_GRILL],
  'king-prawns': [PRAWN_CURRY, FALLBACK_GRILL, FISH_FRY],
  'seer-fish': [FISH_FRY, PRAWN_CURRY, FALLBACK_PAN_FRY],
  'rohu-fish': [FISH_FRY, FALLBACK_COCONUT_CURRY, FALLBACK_PAN_FRY],
};

/**
 * Look up the recipe rail for a given product slug. Falls back to the
 * generic trio when the product isn't specifically mapped.
 */
export function getRecipesForSlug(slug: string): readonly Recipe[] {
  return RECIPES_BY_SLUG[slug] ?? FALLBACK;
}
