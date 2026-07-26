import { ROLES, type Role } from '@elite/shared';

import type { IconName } from '@/components/ui';
import { ROUTES } from '@/routes/paths';

export interface NavItem {
  label: string;
  to: string;
  icon: IconName;
  /** If set, only these roles see the item. Omit to allow all staff roles. */
  roles?: Role[];
  /** Match child routes too (e.g. detail pages) for active-state. */
  matchPrefix?: string;
  /** Optional right-aligned chip (count / status). Rendered when collapsed=false. */
  badge?: string | number;
}

export interface NavGroup {
  /** Section heading (rendered uppercase in the sidebar). Omit for a floating item. */
  label?: string;
  items: NavItem[];
}

const MANAGERS: Role[] = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.STORE_MANAGER];
const INVENTORY: Role[] = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.INVENTORY_MANAGER];
const DELIVERY: Role[] = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.DELIVERY_MANAGER];
const ADMINS: Role[] = [ROLES.SUPER_ADMIN, ROLES.ADMIN];

/**
 * Sidebar information architecture. The Sidebar renders these groups and hides
 * items the current user's role cannot access. Group labels drive the small
 * uppercase section headings; add `badge` to any item to surface a right-side
 * chip (e.g. pending-order count).
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [{ label: 'Dashboard', to: ROUTES.dashboard, icon: 'dashboard' }],
  },
  {
    label: 'Catalog',
    items: [
      { label: 'Products', to: ROUTES.products, icon: 'box', matchPrefix: '/catalog/products' },
      { label: 'Categories', to: ROUTES.categories, icon: 'layers' },
      { label: 'Brands', to: ROUTES.brands, icon: 'tag' },
      { label: 'Attributes', to: ROUTES.attributes, icon: 'sliders' },
    ],
  },
  {
    label: 'Inventory',
    items: [
      { label: 'Stock', to: ROUTES.inventoryStock, icon: 'warehouse', roles: INVENTORY },
      { label: 'Purchases', to: ROUTES.purchases, icon: 'clipboard', roles: INVENTORY },
      { label: 'Suppliers', to: ROUTES.suppliers, icon: 'suppliers', roles: INVENTORY },
      { label: 'Warehouses', to: ROUTES.warehouses, icon: 'warehouse', roles: INVENTORY },
    ],
  },
  {
    label: 'Sales',
    items: [
      { label: 'Orders', to: ROUTES.orders, icon: 'cart', matchPrefix: '/sales/orders' },
      { label: 'Coupons', to: ROUTES.coupons, icon: 'ticket', roles: MANAGERS },
    ],
  },
  {
    label: 'Delivery',
    items: [
      { label: 'Board', to: ROUTES.deliveryBoard, icon: 'truck', roles: DELIVERY },
      { label: 'Zones', to: ROUTES.deliveryZones, icon: 'map', roles: DELIVERY },
      { label: 'Slots', to: ROUTES.deliverySlots, icon: 'clock', roles: DELIVERY },
      { label: 'Partners', to: ROUTES.deliveryPartners, icon: 'users', roles: DELIVERY },
    ],
  },
  {
    label: 'Customers',
    items: [
      { label: 'Customers', to: ROUTES.customers, icon: 'users', matchPrefix: '/customers' },
      { label: 'Reviews', to: ROUTES.reviews, icon: 'star' },
    ],
  },
  {
    label: 'CMS',
    items: [
      { label: 'Pages', to: ROUTES.cmsPages, icon: 'file', roles: MANAGERS },
      { label: 'Banners', to: ROUTES.banners, icon: 'image', roles: MANAGERS },
    ],
  },
  {
    label: 'System',
    items: [
      { label: 'Reports', to: ROUTES.reports, icon: 'chart', roles: MANAGERS },
      { label: 'Settings', to: ROUTES.settings, icon: 'settings', roles: ADMINS },
      { label: 'Roles', to: ROUTES.roles, icon: 'shield', roles: ADMINS },
    ],
  },
];
