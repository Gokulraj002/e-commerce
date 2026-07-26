/** Barrel for the client-side recipes feature. Consumed by the PDP. */
export {
  getRecipesForSlug,
  type Recipe,
  type RecipeDifficulty,
} from './recipes.data';
export { RecipeCard, type RecipeCardProps } from './RecipeCard';
export { RecipeModal, type RecipeModalProps } from './RecipeModal';
