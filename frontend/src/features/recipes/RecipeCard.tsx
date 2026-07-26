/**
 * Recipe rail card — a single editorial "cook this tonight" tile.
 *
 * Composition:
 *   - 4:3 cover image (Unsplash food photo) with a soft ink overlay so the
 *     gold "Recipe" eyebrow reads on any background.
 *   - Playfair recipe title (2 lines, ellipsis).
 *   - Two chips underneath: cook-time (with a clock glyph) and difficulty
 *     (colour-tinted by tier so shoppers can scan the rail at a glance).
 *   - A gold "View recipe →" affordance in the card's meta strip.
 *
 * The card is a plain button — parent owns the modal state so a keyboard
 * user can Tab in and press Enter/Space to open the recipe.
 */
import type { Recipe } from './recipes.data';

export interface RecipeCardProps {
  recipe: Recipe;
  onOpen: (recipe: Recipe) => void;
  /** Index in the rail — used to stagger a light reveal delay upstream. */
  index?: number;
}

export function RecipeCard({ recipe, onOpen }: RecipeCardProps): JSX.Element {
  const handleOpen = (): void => onOpen(recipe);

  return (
    <button
      type="button"
      onClick={handleOpen}
      className="en-pdp-v3__recipe-card"
      aria-label={`View recipe: ${recipe.title}`}
    >
      <div className="en-pdp-v3__recipe-cover">
        <img
          src={recipe.image}
          alt=""
          loading="lazy"
          decoding="async"
          className="en-pdp-v3__recipe-img"
          draggable={false}
        />
        <span className="en-pdp-v3__recipe-eyebrow">Recipe</span>
      </div>
      <div className="en-pdp-v3__recipe-body">
        <h3 className="en-pdp-v3__recipe-title">{recipe.title}</h3>
        <div className="en-pdp-v3__recipe-chips" aria-hidden>
          <span className="en-pdp-v3__recipe-chip">
            <span className="en-pdp-v3__recipe-chip-icon">⏱</span>
            <span>{recipe.cookTime}</span>
          </span>
          <span
            className={`en-pdp-v3__recipe-chip en-pdp-v3__recipe-chip--diff en-pdp-v3__recipe-chip--${recipe.difficulty.toLowerCase()}`}
          >
            <span className="en-pdp-v3__recipe-chip-icon">◈</span>
            <span>{recipe.difficulty}</span>
          </span>
        </div>
        <span className="en-pdp-v3__recipe-link">
          View recipe <span aria-hidden>→</span>
        </span>
      </div>
    </button>
  );
}
