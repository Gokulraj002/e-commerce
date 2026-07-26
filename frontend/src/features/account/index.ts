/** Barrel for the account feature — API, hooks, helpers and shell components. */
export * from './profile.api';
export * from './order.api';
export * from './address.api';
export * from './cms.api';

export * from './useProfile';
export * from './useOrders';
export * from './useAddresses';
export * from './useCmsPage';

export * from './orderStatus';

export { AuthGate } from './AuthGate';
export { AccountLayout, type AccountLayoutProps } from './AccountLayout';
