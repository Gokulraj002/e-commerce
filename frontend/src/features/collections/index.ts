/**
 * Barrel export for the curated meal-boxes feature.
 *
 * TODO(home-strip integrator): Home.tsx does not yet render a Collections
 * strip. Once the Home team is ready, drop a section like:
 *
 *   import { CollectionCard, COLLECTIONS } from '@/features/collections';
 *   // …inside the Home layout, after `<FeaturedEditorial />`:
 *   <section className="en-section en-container">
 *     <div className="en-section-head">
 *       <div>
 *         <span className="en-eyebrow d-block mb-2">Curated by our chefs</span>
 *         <h2 className="en-display h1 mb-0">Meal boxes</h2>
 *       </div>
 *       <Link to={paths.collections()} className="en-link-reset en-text-dim small">
 *         See all boxes →
 *       </Link>
 *     </div>
 *     <div className="en-collections-grid">
 *       {COLLECTIONS.slice(0, 2).map((c, i) => (
 *         <CollectionCard key={c.id} collection={c} index={i} />
 *       ))}
 *     </div>
 *   </section>
 *
 * Kept out of Home.tsx for now — another agent owns that file.
 */
export { CollectionCard, type CollectionCardProps } from './CollectionCard';
export {
  COLLECTIONS,
  findCollectionBySlug,
  type Collection,
  type CollectionItem,
  type CollectionBadge,
} from './collections.data';
