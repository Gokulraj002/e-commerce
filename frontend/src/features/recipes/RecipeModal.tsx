/**
 * Recipe modal — full ingredient list + numbered method for a single recipe.
 *
 * Renders inside the shared `Modal` primitive (framer-motion fade/scale, ESC
 * to dismiss, backdrop click). The body is laid out as a two-column magazine
 * on wide screens (ingredients left, method right) and stacks on mobile.
 *
 * Content is pulled from `recipes.data.ts` and passed in — no fetches, no
 * loading states. Rendering `null` when `recipe` is nullish keeps the parent
 * unconditional and clean.
 */
import { Modal } from '@/components/ui/Modal';

import type { Recipe } from './recipes.data';

export interface RecipeModalProps {
  open: boolean;
  recipe: Recipe | null;
  onClose: () => void;
}

export function RecipeModal({ open, recipe, onClose }: RecipeModalProps): JSX.Element | null {
  // If a caller opens the modal without a recipe (defensive), render nothing —
  // Modal itself already handles the closed state.
  if (!recipe) return null;

  return (
    <Modal open={open} onClose={onClose} title={recipe.title}>
      <div className="en-pdp-v3__recipe-modal">
        <div
          className="en-pdp-v3__recipe-modal-hero"
          style={{ backgroundImage: `url("${recipe.image}")` }}
          aria-hidden
        />
        <p className="en-pdp-v3__recipe-modal-intro">{recipe.intro}</p>
        <div className="en-pdp-v3__recipe-modal-meta">
          <span className="en-pdp-v3__recipe-chip">
            <span aria-hidden className="en-pdp-v3__recipe-chip-icon">
              ⏱
            </span>
            <span>{recipe.cookTime}</span>
          </span>
          <span
            className={`en-pdp-v3__recipe-chip en-pdp-v3__recipe-chip--diff en-pdp-v3__recipe-chip--${recipe.difficulty.toLowerCase()}`}
          >
            <span aria-hidden className="en-pdp-v3__recipe-chip-icon">
              ◈
            </span>
            <span>{recipe.difficulty}</span>
          </span>
        </div>

        <div className="en-pdp-v3__recipe-modal-grid">
          <section aria-labelledby="en-recipe-ingredients-title">
            <h4
              id="en-recipe-ingredients-title"
              className="en-pdp-v3__recipe-modal-heading"
            >
              Ingredients
            </h4>
            <ul className="en-pdp-v3__recipe-modal-ingredients">
              {recipe.ingredients.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="en-recipe-method-title">
            <h4
              id="en-recipe-method-title"
              className="en-pdp-v3__recipe-modal-heading"
            >
              Method
            </h4>
            <ol className="en-pdp-v3__recipe-modal-steps">
              {recipe.steps.map((step, i) => (
                <li key={i}>
                  <span className="en-pdp-v3__recipe-modal-step-number" aria-hidden>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </Modal>
  );
}
