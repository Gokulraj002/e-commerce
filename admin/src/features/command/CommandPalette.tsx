import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { Icon, Spinner, type IconName } from '@/components/ui';
import { listAdminProducts } from '@/features/catalog';
import { fetchAdminOrders, fetchCustomers } from '@/features/sales/sales.api';
import { ROUTES } from '@/routes/paths';

import { useCommandPalette } from './useCommandPalette';

type SectionId = 'recent' | 'navigate' | 'actions' | 'products' | 'orders' | 'customers';

interface PaletteItem {
  id: string;
  section: SectionId;
  icon: IconName;
  label: string;
  meta?: string;
  onSelect: () => void;
}

interface Section {
  id: SectionId;
  label: string;
  loading: boolean;
  items: PaletteItem[];
}

interface RenderedSection extends Section {
  /** Index of this section's first item within the flat, keyboard-navigable list. */
  startIndex: number;
}

/** Top-level admin destinations shown in the "Navigate" section. */
const NAVIGATE_ROUTES: Array<{ to: string; label: string; icon: IconName }> = [
  { to: ROUTES.dashboard, label: 'Dashboard', icon: 'dashboard' },
  { to: ROUTES.products, label: 'Products', icon: 'box' },
  { to: ROUTES.productNew, label: 'New product', icon: 'plus' },
  { to: ROUTES.categories, label: 'Categories', icon: 'layers' },
  { to: ROUTES.brands, label: 'Brands', icon: 'tag' },
  { to: ROUTES.attributes, label: 'Attributes', icon: 'sliders' },
  { to: ROUTES.inventoryStock, label: 'Inventory · Stock', icon: 'warehouse' },
  { to: ROUTES.purchases, label: 'Inventory · Purchases', icon: 'clipboard' },
  { to: ROUTES.suppliers, label: 'Inventory · Suppliers', icon: 'suppliers' },
  { to: ROUTES.warehouses, label: 'Inventory · Warehouses', icon: 'warehouse' },
  { to: ROUTES.orders, label: 'Orders', icon: 'cart' },
  { to: ROUTES.coupons, label: 'Coupons', icon: 'ticket' },
  { to: ROUTES.deliveryBoard, label: 'Delivery · Board', icon: 'truck' },
  { to: ROUTES.deliveryZones, label: 'Delivery · Zones', icon: 'map' },
  { to: ROUTES.deliverySlots, label: 'Delivery · Slots', icon: 'clock' },
  { to: ROUTES.deliveryPartners, label: 'Delivery · Partners', icon: 'users' },
  { to: ROUTES.customers, label: 'Customers', icon: 'users' },
  { to: ROUTES.reviews, label: 'Reviews', icon: 'star' },
  { to: ROUTES.cmsPages, label: 'CMS pages', icon: 'file' },
  { to: ROUTES.banners, label: 'Banners', icon: 'image' },
  { to: ROUTES.reports, label: 'Reports', icon: 'chart' },
  { to: ROUTES.settings, label: 'Settings', icon: 'settings' },
  { to: ROUTES.roles, label: 'Roles', icon: 'shield' },
];

/**
 * Static shortcuts to create-form entry points. Coupons / purchases / CMS
 * pages open their drawer from the list page, so we deep-link to the list
 * itself rather than a non-existent "/new" route.
 */
const ACTION_ITEMS: Array<{ label: string; to: string; icon: IconName }> = [
  { label: 'Create product', to: ROUTES.productNew, icon: 'plus' },
  { label: 'New coupon', to: ROUTES.coupons, icon: 'ticket' },
  { label: 'New purchase', to: ROUTES.purchases, icon: 'clipboard' },
  { label: 'New CMS page', to: ROUTES.cmsPages, icon: 'file' },
];

/** Zero-query landing state — a small handful of the most-used destinations. */
const FREQUENT_ITEMS: Array<{ label: string; to: string; icon: IconName }> = [
  { label: 'Dashboard', to: ROUTES.dashboard, icon: 'dashboard' },
  { label: 'Products', to: ROUTES.products, icon: 'box' },
  { label: 'Orders', to: ROUTES.orders, icon: 'cart' },
  { label: 'Delivery Board', to: ROUTES.deliveryBoard, icon: 'truck' },
  { label: 'Reports', to: ROUTES.reports, icon: 'chart' },
];

const SECTION_LABELS: Record<SectionId, string> = {
  recent: 'Frequently used',
  navigate: 'Navigate',
  actions: 'Actions',
  products: 'Products',
  orders: 'Orders',
  customers: 'Customers',
};

const MAX_RECORDS = 6;
const SEARCH_DEBOUNCE_MS = 250;

/** Trailing-edge debounce that follows the latest value after `delayMs`. */
function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handle = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(handle);
  }, [value, delayMs]);
  return debounced;
}

/** Case-insensitive substring match used to filter static sections locally. */
function includesCI(haystack: string, needle: string): boolean {
  if (!needle) return true;
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

/** Best-effort platform hint so the footer / chip show the right modifier glyph. */
function isMacLike(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Mac|iPod|iPhone|iPad/i.test(navigator.userAgent);
}

/**
 * AdminShell v3 command palette — full-screen dialog surfaced by ⌘K / Ctrl+K.
 * Combines local search over the route table + static actions with three
 * debounced API-side searches (products, orders, customers). Keyboard driven
 * end-to-end: arrow keys move, Enter opens, Escape closes.
 *
 * With no query typed the palette shows a curated "Frequently used" list so
 * the empty state is instantly useful.
 */
export function CommandPalette() {
  const { isOpen, close } = useCommandPalette();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const [rawSearch, setRawSearch] = useState('');
  const [cursor, setCursor] = useState(0);
  const debouncedSearch = useDebouncedValue(rawSearch, SEARCH_DEBOUNCE_MS);
  const searchTrim = debouncedSearch.trim();
  const hasSearch = searchTrim.length > 0;

  // Reset transient state whenever the dialog opens, and focus the input on the
  // next paint so the browser doesn't drop the request during the mount.
  useEffect(() => {
    if (!isOpen) return;
    setRawSearch('');
    setCursor(0);
    const raf = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(raf);
  }, [isOpen]);

  // Async fetches — gated on `isOpen && hasSearch` so we never spam the API on
  // mount or with an empty query. React Query dedupes concurrent requests and
  // keeps a 30s stale window so repeat opens feel instant.
  const productsQuery = useQuery({
    queryKey: ['command-palette', 'products', searchTrim],
    queryFn: () => listAdminProducts({ page: 1, pageSize: MAX_RECORDS, search: searchTrim }),
    enabled: isOpen && hasSearch,
    staleTime: 30_000,
  });

  const ordersQuery = useQuery({
    queryKey: ['command-palette', 'orders', searchTrim],
    queryFn: () => fetchAdminOrders({ page: 1, pageSize: MAX_RECORDS, search: searchTrim }),
    enabled: isOpen && hasSearch,
    staleTime: 30_000,
  });

  const customersQuery = useQuery({
    queryKey: ['command-palette', 'customers', searchTrim],
    queryFn: () => fetchCustomers({ page: 1, pageSize: MAX_RECORDS, search: searchTrim }),
    enabled: isOpen && hasSearch,
    staleTime: 30_000,
  });

  const go = useCallback(
    (to: string) => {
      close();
      navigate(to);
    },
    [close, navigate],
  );

  // Build the grouped sections. Order here dictates the visual + keyboard order.
  const sections = useMemo<Section[]>(() => {
    // Zero-query state: surface the "Frequently used" shortcut list on its own,
    // followed by the static Navigate / Actions items so ⌘K is instantly usable.
    if (!hasSearch) {
      const recentItems: PaletteItem[] = FREQUENT_ITEMS.map((r) => ({
        id: `recent:${r.to}`,
        section: 'recent',
        icon: r.icon,
        label: r.label,
        meta: r.to,
        onSelect: () => go(r.to),
      }));
      const navigateItems: PaletteItem[] = NAVIGATE_ROUTES.map((r) => ({
        id: `nav:${r.to}`,
        section: 'navigate',
        icon: r.icon,
        label: r.label,
        meta: r.to,
        onSelect: () => go(r.to),
      }));
      const actionsItems: PaletteItem[] = ACTION_ITEMS.map((a) => ({
        id: `action:${a.label}`,
        section: 'actions',
        icon: a.icon,
        label: a.label,
        meta: a.to,
        onSelect: () => go(a.to),
      }));
      return [
        { id: 'recent', label: SECTION_LABELS.recent, loading: false, items: recentItems },
        { id: 'navigate', label: SECTION_LABELS.navigate, loading: false, items: navigateItems },
        { id: 'actions', label: SECTION_LABELS.actions, loading: false, items: actionsItems },
      ];
    }

    const navigateItems: PaletteItem[] = NAVIGATE_ROUTES.filter(
      (r) => includesCI(r.label, searchTrim) || includesCI(r.to, searchTrim),
    ).map((r) => ({
      id: `nav:${r.to}`,
      section: 'navigate',
      icon: r.icon,
      label: r.label,
      meta: r.to,
      onSelect: () => go(r.to),
    }));

    const actionsItems: PaletteItem[] = ACTION_ITEMS.filter((a) =>
      includesCI(a.label, searchTrim),
    ).map((a) => ({
      id: `action:${a.label}`,
      section: 'actions',
      icon: a.icon,
      label: a.label,
      meta: a.to,
      onSelect: () => go(a.to),
    }));

    const productsItems: PaletteItem[] = (productsQuery.data?.items ?? [])
      .slice(0, MAX_RECORDS)
      .map((p) => ({
        id: `product:${p.id}`,
        section: 'products',
        icon: 'box',
        label: p.name,
        meta: ROUTES.productEdit(p.slug),
        onSelect: () => go(ROUTES.productEdit(p.slug)),
      }));

    const ordersItems: PaletteItem[] = (ordersQuery.data?.items ?? [])
      .slice(0, MAX_RECORDS)
      .map((o) => ({
        id: `order:${o.id}`,
        section: 'orders',
        icon: 'cart',
        label: `${o.code} · ${o.address.name}`,
        meta: ROUTES.orderDetail(o.code),
        onSelect: () => go(ROUTES.orderDetail(o.code)),
      }));

    const customersItems: PaletteItem[] = (customersQuery.data?.items ?? [])
      .slice(0, MAX_RECORDS)
      .map((c) => ({
        id: `customer:${c.id}`,
        section: 'customers',
        icon: 'users',
        label: c.name?.trim() || c.phone,
        meta: c.email ?? c.phone,
        onSelect: () => go(ROUTES.customerDetail(c.id)),
      }));

    return [
      { id: 'navigate', label: SECTION_LABELS.navigate, loading: false, items: navigateItems },
      { id: 'actions', label: SECTION_LABELS.actions, loading: false, items: actionsItems },
      {
        id: 'products',
        label: SECTION_LABELS.products,
        loading: productsQuery.isFetching,
        items: productsItems,
      },
      {
        id: 'orders',
        label: SECTION_LABELS.orders,
        loading: ordersQuery.isFetching,
        items: ordersItems,
      },
      {
        id: 'customers',
        label: SECTION_LABELS.customers,
        loading: customersQuery.isFetching,
        items: customersItems,
      },
    ];
  }, [
    searchTrim,
    hasSearch,
    productsQuery.data,
    productsQuery.isFetching,
    ordersQuery.data,
    ordersQuery.isFetching,
    customersQuery.data,
    customersQuery.isFetching,
    go,
  ]);

  // Annotate each section with its starting flat index so item render can compute
  // absolute keyboard positions without indexOf() scans.
  const renderedSections = useMemo<RenderedSection[]>(() => {
    let offset = 0;
    return sections.map((section) => {
      const startIndex = offset;
      offset += section.items.length;
      return { ...section, startIndex };
    });
  }, [sections]);

  const flatItems = useMemo(() => sections.flatMap((s) => s.items), [sections]);

  const anyLoading =
    hasSearch &&
    (productsQuery.isFetching || ordersQuery.isFetching || customersQuery.isFetching);

  // Keep the cursor in range whenever the list shape changes (async results
  // land, filter narrows, etc.) so Enter always resolves to a real row.
  useEffect(() => {
    setCursor((c) => (flatItems.length === 0 ? 0 : Math.min(c, flatItems.length - 1)));
  }, [flatItems]);

  // Any new keystroke resets the cursor so the top result stays highlighted.
  useEffect(() => {
    setCursor(0);
  }, [rawSearch]);

  // Follow the highlighted row into view as the user arrow-keys through a long list.
  useEffect(() => {
    if (!listRef.current) return;
    const active = listRef.current.querySelector<HTMLElement>('[data-active="true"]');
    active?.scrollIntoView({ block: 'nearest' });
  }, [cursor, flatItems]);

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (flatItems.length > 0) setCursor((c) => (c + 1) % flatItems.length);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (flatItems.length > 0) {
        setCursor((c) => (c - 1 + flatItems.length) % flatItems.length);
      }
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const item = flatItems[cursor];
      if (item) item.onSelect();
    }
  };

  const swallowClick = (event: ReactMouseEvent<HTMLDivElement>) => event.stopPropagation();

  if (!isOpen) return null;

  const modifierGlyph = isMacLike() ? '⌘' : 'Ctrl';

  return (
    <div className="ui-cmd-backdrop" onClick={close} role="presentation">
      <div
        className="ui-cmd"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onClick={swallowClick}
        onKeyDown={handleKeyDown}
      >
        <div className="ui-cmd__search">
          <span className="ui-cmd__search-icon" aria-hidden="true">
            <Icon name="search" size={20} />
          </span>
          <input
            ref={inputRef}
            type="text"
            className="ui-cmd__input"
            placeholder="Jump to a page, product, order, or customer…"
            value={rawSearch}
            onChange={(e) => setRawSearch(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            aria-label="Command palette search"
          />
          {anyLoading && (
            <span className="ui-cmd__search-spinner" aria-hidden="true">
              <Spinner size="sm" />
            </span>
          )}
          <kbd className="ui-cmd__kbd ui-cmd__kbd--muted">esc</kbd>
        </div>

        <div className="ui-cmd__list" ref={listRef}>
          {flatItems.length === 0 ? (
            <div className="ui-cmd__empty">
              {hasSearch ? (anyLoading ? 'Searching…' : 'No matches for that query.') : ''}
            </div>
          ) : (
            renderedSections.map((section) => {
              if (section.items.length === 0) return null;
              return (
                <div key={section.id} className="ui-cmd__section">
                  <div className="ui-cmd__heading">
                    <span>{section.label}</span>
                    {section.loading && hasSearch && <Spinner size="sm" />}
                  </div>
                  {section.items.map((item, i) => {
                    const flatIndex = section.startIndex + i;
                    const active = flatIndex === cursor;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className="ui-cmd__row"
                        data-active={active ? 'true' : 'false'}
                        onMouseEnter={() => setCursor(flatIndex)}
                        onClick={item.onSelect}
                      >
                        <span className="ui-cmd__row-icon" aria-hidden="true">
                          <Icon name={item.icon} size={16} />
                        </span>
                        <span className="ui-cmd__row-label">{item.label}</span>
                        {item.meta && <span className="ui-cmd__row-meta">{item.meta}</span>}
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        <div className="ui-cmd__footer">
          <span className="ui-cmd__hint">
            <kbd className="ui-cmd__kbd">↑</kbd>
            <kbd className="ui-cmd__kbd">↓</kbd>
            <span>navigate</span>
          </span>
          <span className="ui-cmd__hint">
            <kbd className="ui-cmd__kbd">↵</kbd>
            <span>open</span>
          </span>
          <span className="ui-cmd__hint">
            <kbd className="ui-cmd__kbd">esc</kbd>
            <span>close</span>
          </span>
          <span className="ui-cmd__hint ui-cmd__hint--muted">
            <kbd className="ui-cmd__kbd">{modifierGlyph}</kbd>
            <kbd className="ui-cmd__kbd">K</kbd>
            <span>toggle</span>
          </span>
        </div>
      </div>
    </div>
  );
}
