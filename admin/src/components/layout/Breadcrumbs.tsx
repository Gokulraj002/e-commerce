import { Fragment } from 'react';
import { Link, useLocation } from 'react-router-dom';

import { ROUTES } from '@/routes/paths';

/** Human labels for path segments; unmapped segments are title-cased. */
const SEGMENT_LABELS: Record<string, string> = {
  catalog: 'Catalog',
  products: 'Products',
  categories: 'Categories',
  brands: 'Brands',
  attributes: 'Attributes',
  inventory: 'Inventory',
  stock: 'Stock',
  purchases: 'Purchases',
  suppliers: 'Suppliers',
  warehouses: 'Warehouses',
  sales: 'Sales',
  orders: 'Orders',
  coupons: 'Coupons',
  delivery: 'Delivery',
  board: 'Board',
  zones: 'Zones',
  slots: 'Slots',
  partners: 'Partners',
  customers: 'Customers',
  reviews: 'Reviews',
  cms: 'CMS',
  pages: 'Pages',
  banners: 'Banners',
  reports: 'Reports',
  settings: 'Settings',
  roles: 'Roles',
  new: 'New',
  edit: 'Edit',
};

function labelFor(segment: string): string {
  return (
    SEGMENT_LABELS[segment] ??
    segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ')
  );
}

/**
 * Auto-generated breadcrumb trail from the current path. Uses `›` separators
 * and bolds the final crumb in ink-900 so the current location reads clearly
 * from the topbar. Hidden on the dashboard root to avoid a lone "Home" chip.
 */
export function Breadcrumbs() {
  const { pathname } = useLocation();
  const segments = pathname.split('/').filter(Boolean);

  let acc = '';
  const crumbs = segments.map((seg, i) => {
    acc += `/${seg}`;
    return { label: labelFor(seg), href: acc, last: i === segments.length - 1 };
  });

  const showHomeOnly = segments.length === 0;

  return (
    <nav aria-label="Breadcrumb" className="app-crumbs">
      <ol className="app-crumbs__list">
        <li className="app-crumbs__item">
          {showHomeOnly ? (
            <span className="app-crumbs__current">Dashboard</span>
          ) : (
            <Link to={ROUTES.dashboard} className="app-crumbs__link">
              Home
            </Link>
          )}
        </li>
        {crumbs.map((c) => (
          <Fragment key={c.href}>
            <li className="app-crumbs__sep" aria-hidden="true">
              ›
            </li>
            <li className="app-crumbs__item">
              {c.last ? (
                <span className="app-crumbs__current" aria-current="page">
                  {c.label}
                </span>
              ) : (
                <Link to={c.href} className="app-crumbs__link">
                  {c.label}
                </Link>
              )}
            </li>
          </Fragment>
        ))}
      </ol>
    </nav>
  );
}
