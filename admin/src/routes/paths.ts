/**
 * Central route registry. Import these constants instead of hard-coding path
 * strings so links, the router, and the sidebar never drift apart. Functions
 * build parameterised URLs (e.g. `ROUTES.orderDetail(id)`).
 */
export const ROUTES = {
  login: '/login',

  dashboard: '/',

  // Catalog
  products: '/catalog/products',
  productNew: '/catalog/products/new',
  productEdit: (id = ':id') => `/catalog/products/${id}/edit`,
  categories: '/catalog/categories',
  brands: '/catalog/brands',
  attributes: '/catalog/attributes',

  // Inventory
  inventoryStock: '/inventory/stock',
  purchases: '/inventory/purchases',
  suppliers: '/inventory/suppliers',
  warehouses: '/inventory/warehouses',

  // Sales
  orders: '/sales/orders',
  orderDetail: (id = ':id') => `/sales/orders/${id}`,
  coupons: '/sales/coupons',

  // Delivery
  deliveryBoard: '/delivery/board',
  deliveryZones: '/delivery/zones',
  deliverySlots: '/delivery/slots',
  deliveryPartners: '/delivery/partners',

  // Customers
  customers: '/customers',
  customerDetail: (id = ':id') => `/customers/${id}`,

  // Reviews
  reviews: '/reviews',

  // CMS
  cmsPages: '/cms/pages',
  banners: '/cms/banners',

  // Ops
  reports: '/reports',
  settings: '/settings',
  roles: '/settings/roles',
} as const;
