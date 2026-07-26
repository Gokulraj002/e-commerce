import { ProductCard, useRelatedProducts } from '@/features/catalog';
import { Skeleton } from '@/components/ui';

export interface RelatedProductsProps {
  slug: string;
}

/** "You may also like" strip — reuses the shared catalog ProductCard. */
export function RelatedProducts({ slug }: RelatedProductsProps): JSX.Element | null {
  const { data: products, isLoading } = useRelatedProducts(slug);

  if (isLoading) {
    return (
      <div className="en-scroller en-scroller--lg-grid">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="en-card p-3">
            <Skeleton height={150} className="mb-3" />
            <Skeleton width="70%" height={18} className="mb-2" />
            <Skeleton width="40%" height={16} />
          </div>
        ))}
      </div>
    );
  }

  if (!products || products.length === 0) return null;

  return (
    <div className="en-scroller en-scroller--lg-grid">
      {products.map((product, i) => (
        <ProductCard key={product.id} product={product} index={i} />
      ))}
    </div>
  );
}
