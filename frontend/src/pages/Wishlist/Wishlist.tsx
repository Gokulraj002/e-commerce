import { Link } from 'react-router-dom';

import { Button, EmptyState, Skeleton } from '@/components/ui';
import { AccountLayout } from '@/features/account/AccountLayout';
import {
  useAddToWishlist as _useAdd,
  useMoveToCart,
  useRemoveFromWishlist,
  useWishlist,
} from '@/features/wishlist/useWishlist';
import { formatPaise } from '@/lib/money';
import { paths } from '@/routes/routes';

// keep the unused import from tripping isolatedModules; underscore-prefix is fine
void _useAdd;

export default function Wishlist(): JSX.Element {
  const { data, isLoading } = useWishlist();
  const remove = useRemoveFromWishlist();
  const move = useMoveToCart();

  return (
    <AccountLayout eyebrow="Saved for you" title="My Wishlist">
      {isLoading ? (
        <div className="row g-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div className="col-6 col-md-4 col-lg-3" key={i}>
              <Skeleton height={180} />
              <div style={{ marginTop: 8 }}>
                <Skeleton height={16} />
              </div>
              <Skeleton height={16} width="60%" />
            </div>
          ))}
        </div>
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          title="Your wishlist is empty"
          description="Tap the heart on any cut to save it here for later."
          action={
            <Link to={paths.home()}>
              <Button variant="primary">Browse the store</Button>
            </Link>
          }
        />
      ) : (
        <div className="row g-3">
          {data.items.map((item) => (
            <div className="col-6 col-md-4 col-lg-3" key={item.id}>
              <div
                className="en-card"
                style={{
                  padding: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  height: '100%',
                }}
              >
                <Link
                  to={paths.product(item.slug)}
                  style={{ display: 'block', borderRadius: 8, overflow: 'hidden' }}
                >
                  {item.image ? (
                    <img
                      src={item.image}
                      alt={item.name}
                      style={{ width: '100%', height: 160, objectFit: 'cover' }}
                    />
                  ) : (
                    <div
                      style={{
                        width: '100%',
                        height: 160,
                        background: 'rgba(27, 26, 23, 0.05)',
                      }}
                    />
                  )}
                </Link>
                <Link
                  to={paths.product(item.slug)}
                  style={{ color: 'var(--en-text)', fontWeight: 600, textDecoration: 'none' }}
                >
                  {item.name}
                </Link>
                <div style={{ color: 'var(--en-gold)', fontWeight: 600 }}>
                  {item.pricePaise != null ? `From ${formatPaise(item.pricePaise)}` : 'Unavailable'}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={item.pricePaise == null || move.isPending}
                    onClick={() => move.mutate(item.productId)}
                  >
                    Move to cart
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={remove.isPending}
                    onClick={() => remove.mutate(item.productId)}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </AccountLayout>
  );
}
