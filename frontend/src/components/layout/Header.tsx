/**
 * Customer-facing app header.
 *
 * Two visual rows on desktop:
 *   1. Primary row — brand, nav trigger, search, pincode, account, cart.
 *   2. Category strip (≥md) — flat wayfinding bar with "Bulk orders"
 *      and "New arrivals" utility links on the right.
 *
 * A full-width megamenu hangs off the "Shop" trigger with three columns:
 *   left  — top-level categories (from `useCategories`, with static fallback)
 *   mid   — sub-categories of the hovered category, or a curated
 *           "Popular cuts" grid pulled from `useFeaturedProducts`
 *   right — a promo tile (from `useBanners('HOME_STRIP')` when available,
 *           else a static "Free delivery over ₹699" card)
 *
 * On <md the primary row hides its inline navigation and shows a hamburger
 * that opens a left-anchored full-height drawer with the same categories,
 * account shortcuts, and a big "Deliver to" pincode row on top.
 */
import { AnimatePresence, motion, useAnimationControls, useReducedMotion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';

import type { ProductDTO } from '@elite/shared';
import { STORE } from '@elite/shared';

import { useAuth } from '@/features/auth/useAuth';
import { CartDrawer } from '@/features/cart/CartDrawer';
import { useCartDrawer } from '@/features/cart/CartDrawerContext';
import { useCart } from '@/features/cart/useCart';
import {
  cheapestVariant,
  useBanners,
  useCategories,
  useFeaturedProducts,
  type CategoryNodeDTO,
} from '@/features/catalog';
import { SearchDropdown } from '@/features/search';
import { ServiceabilityModal, useServiceability } from '@/features/serviceability';
import { formatPaise } from '@/lib/money';
import { paths } from '@/routes/routes';

import { NAV_CATEGORIES, type NavCategory } from './navData';

const PROMO_BANNER_POSITION = 'HOME_STRIP';

/** Utility links pinned to the right side of the category strip. */
const UTILITY_LINKS: ReadonlyArray<{ label: string; to: string; kind: 'cta' | 'pill'; emoji: string }> = [
  { label: 'Bulk orders', to: paths.cms('bulk-orders'), kind: 'cta', emoji: '📦' },
  { label: 'New arrivals', to: paths.search('new'), kind: 'pill', emoji: '✨' },
];

/**
 * Static bridge from category slug → emoji, so the megamenu can render an
 * icon even before `useCategories()` resolves. Slugs the API returns that
 * aren't in NAV_CATEGORIES fall back to a generic meat icon.
 */
function emojiForSlug(slug: string): string {
  return NAV_CATEGORIES.find((c) => c.slug === slug)?.emoji ?? '🍖';
}

/** First+last initials — e.g. "Anantha Kumar" → "AK", "Priya" → "P". */
function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0][0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? '' : '';
  return (first + last).toUpperCase();
}

/**
 * Normalise the categories feed for the megamenu — we prefer the API answer
 * but fall back to the static list so the megamenu is never empty.
 */
function toNavShape(categories: CategoryNodeDTO[] | undefined): CategoryNodeDTO[] {
  if (categories && categories.length > 0) return categories;
  return NAV_CATEGORIES.map<CategoryNodeDTO>((cat, i) => ({
    id: `static-${cat.slug}`,
    name: cat.name,
    slug: cat.slug,
    imageUrl: null,
    parentId: null,
    sortOrder: i,
    children: [],
  }));
}

/**
 * Small helper button so the megamenu trigger stays self-contained and
 * exposes the correct ARIA relationship to the panel.
 */
interface ShopTriggerProps {
  open: boolean;
  onToggle: () => void;
}
function ShopTrigger({ open, onToggle }: ShopTriggerProps): JSX.Element {
  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm d-flex align-items-center gap-1"
      onClick={onToggle}
      aria-haspopup="true"
      aria-expanded={open}
      aria-controls="en-shop-megamenu"
    >
      Shop <span style={{ fontSize: '0.7rem' }} aria-hidden>▾</span>
    </button>
  );
}

// ── Megamenu ────────────────────────────────────────────────
interface MegamenuProps {
  categories: CategoryNodeDTO[];
  featured: ProductDTO[];
  promoImageUrl: string | null;
  promoTitle: string | null;
  promoLink: string | null;
  onNavigate: () => void;
}
function Megamenu({
  categories,
  featured,
  promoImageUrl,
  promoTitle,
  promoLink,
  onNavigate,
}: MegamenuProps): JSX.Element {
  const [hoveredSlug, setHoveredSlug] = useState<string | null>(categories[0]?.slug ?? null);
  const active = useMemo(
    () => categories.find((c) => c.slug === hoveredSlug) ?? categories[0] ?? null,
    [categories, hoveredSlug],
  );
  const showFeaturedGrid = !active || active.children.length === 0;
  const featuredSlice = featured.slice(0, 6);

  return (
    <motion.div
      id="en-shop-megamenu"
      className="en-megamenu en-megamenu--full"
      role="menu"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.18 }}
    >
      <div className="en-megamenu__grid">
        {/* Left column — category list */}
        <div>
          <p className="en-megamenu__col-title">Shop by cut</p>
          <ul className="en-megamenu__cat-list">
            {categories.map((cat) => {
              const isActive = active?.slug === cat.slug;
              return (
                <li key={cat.id}>
                  <Link
                    to={paths.category(cat.slug)}
                    className={`en-megamenu__cat-link${isActive ? ' is-active' : ''}`}
                    onMouseEnter={() => setHoveredSlug(cat.slug)}
                    onFocus={() => setHoveredSlug(cat.slug)}
                    onClick={onNavigate}
                    role="menuitem"
                  >
                    <span className="en-megamenu__emoji" aria-hidden>
                      {emojiForSlug(cat.slug)}
                    </span>
                    <span>{cat.name}</span>
                    <span className="en-megamenu__chevron" aria-hidden>›</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Middle column — subcategories or curated products */}
        <div>
          <p className="en-megamenu__col-title">
            {showFeaturedGrid ? 'Popular cuts' : `In ${active?.name ?? ''}`}
          </p>
          {showFeaturedGrid ? (
            featuredSlice.length > 0 ? (
              <div className="en-megamenu__products">
                {featuredSlice.map((product) => {
                  const variant = cheapestVariant(product);
                  const image = product.images[0];
                  return (
                    <Link
                      key={product.id}
                      to={paths.product(product.slug)}
                      className="en-megamenu__product"
                      onClick={onNavigate}
                      role="menuitem"
                    >
                      <span className="en-megamenu__product-thumb" aria-hidden>
                        {image ? <img src={image} alt="" loading="lazy" /> : <span>🍖</span>}
                      </span>
                      <span className="en-megamenu__product-meta">
                        <span className="en-megamenu__product-name">{product.name}</span>
                        {variant && (
                          <span className="en-megamenu__product-price">
                            {formatPaise(variant.pricePaise)}
                          </span>
                        )}
                      </span>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <p className="en-text-dim small mb-0">
                Freshly restocked cuts are on the way — browse by category on the left.
              </p>
            )
          ) : (
            <ul className="en-megamenu__sub-list">
              {active!.children.map((child) => (
                <li key={child.id}>
                  <Link
                    to={paths.category(child.slug)}
                    className="en-megamenu__sub-link"
                    onClick={onNavigate}
                    role="menuitem"
                  >
                    {child.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Right column — promotional tile */}
        <div>
          <p className="en-megamenu__col-title">This week</p>
          {promoImageUrl && promoLink ? (
            <Link
              to={promoLink}
              className="en-megamenu__promo"
              onClick={onNavigate}
              role="menuitem"
            >
              <span className="en-megamenu__promo-bg" aria-hidden>
                <img src={promoImageUrl} alt="" loading="lazy" />
              </span>
              <span className="en-megamenu__promo-content">
                <span className="en-megamenu__promo-eyebrow">Featured</span>
                <span className="en-megamenu__promo-title">{promoTitle ?? 'Fresh picks'}</span>
                <span className="en-megamenu__promo-sub">Handpicked by our butchers</span>
              </span>
              <span className="en-megamenu__promo-cta">
                Explore <span aria-hidden>→</span>
              </span>
            </Link>
          ) : (
            <Link
              to={paths.membership()}
              className="en-megamenu__promo en-megamenu__promo--gold"
              onClick={onNavigate}
              role="menuitem"
            >
              <span className="en-megamenu__promo-content">
                <span className="en-megamenu__promo-eyebrow">Free delivery</span>
                <span className="en-megamenu__promo-title">
                  Free shipping on orders over {STORE.CURRENCY_SYMBOL}
                  {STORE.FREE_SHIPPING_THRESHOLD}
                </span>
                <span className="en-megamenu__promo-sub">
                  Members skip the fee on every order.
                </span>
              </span>
              <span className="en-megamenu__promo-cta">
                Join Elite Club <span aria-hidden>→</span>
              </span>
            </Link>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ── Mobile drawer ───────────────────────────────────────────
interface MobileDrawerProps {
  open: boolean;
  onClose: () => void;
  categories: CategoryNodeDTO[];
  isAuthenticated: boolean;
  userName: string | null;
  pincode: string | null;
  onChangePincode: () => void;
  onLogout: () => void;
}
function MobileDrawer({
  open,
  onClose,
  categories,
  isAuthenticated,
  userName,
  pincode,
  onChangePincode,
  onLogout,
}: MobileDrawerProps): JSX.Element {
  // Trap Escape → close, and prevent body scroll while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: globalThis.KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="en-drawer-backdrop"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          />
          <motion.aside
            className="en-drawer en-drawer--left"
            role="dialog"
            aria-modal="true"
            aria-label="Main navigation"
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="en-drawer__header">
              <Link to={paths.home()} className="en-logo en-link-reset" onClick={onClose}>
                Elite<span className="en-logo__accent">NonVeg</span>
              </Link>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={onClose}
                aria-label="Close navigation"
              >
                <span aria-hidden style={{ fontSize: '1.1rem' }}>✕</span>
              </button>
            </div>

            <div className="en-drawer__body">
              {/* Pincode CTA — pinned to the top of the drawer */}
              <button
                type="button"
                className="en-mobile-drawer__pincode"
                onClick={() => {
                  onClose();
                  onChangePincode();
                }}
              >
                <span className="en-mobile-drawer__pincode-icon" aria-hidden>📍</span>
                <span className="en-mobile-drawer__pincode-label">
                  <small>Deliver to</small>
                  <strong>{pincode ?? `${STORE.CITY} — check pincode`}</strong>
                </span>
              </button>

              {/* Categories */}
              <div className="en-mobile-drawer__section">
                <p className="en-mobile-drawer__section-title">Shop by cut</p>
                {categories.map((cat) => (
                  <NavLink
                    key={cat.id}
                    to={paths.category(cat.slug)}
                    className={({ isActive }) =>
                      `en-mobile-drawer__link${isActive ? ' is-active' : ''}`
                    }
                    onClick={onClose}
                  >
                    <span className="en-mobile-drawer__emoji" aria-hidden>
                      {emojiForSlug(cat.slug)}
                    </span>
                    <span>{cat.name}</span>
                  </NavLink>
                ))}
              </div>

              {/* Account */}
              <div className="en-mobile-drawer__section">
                <p className="en-mobile-drawer__section-title">Account</p>
                {isAuthenticated ? (
                  <>
                    <div className="en-mobile-drawer__link" aria-hidden>
                      <span className="en-mobile-drawer__emoji">👤</span>
                      <span>Hi, {userName ?? 'there'}</span>
                    </div>
                    <NavLink to={paths.account()} className="en-mobile-drawer__link" onClick={onClose}>
                      <span className="en-mobile-drawer__emoji" aria-hidden>⚙️</span>
                      <span>My Account</span>
                    </NavLink>
                    <NavLink to={paths.orders()} className="en-mobile-drawer__link" onClick={onClose}>
                      <span className="en-mobile-drawer__emoji" aria-hidden>📦</span>
                      <span>Orders</span>
                    </NavLink>
                    <NavLink to={paths.wishlist()} className="en-mobile-drawer__link" onClick={onClose}>
                      <span className="en-mobile-drawer__emoji" aria-hidden>♡</span>
                      <span>Wishlist</span>
                    </NavLink>
                    <NavLink to={paths.addresses()} className="en-mobile-drawer__link" onClick={onClose}>
                      <span className="en-mobile-drawer__emoji" aria-hidden>🏠</span>
                      <span>Addresses</span>
                    </NavLink>
                    <NavLink to={paths.membership()} className="en-mobile-drawer__link" onClick={onClose}>
                      <span className="en-mobile-drawer__emoji" aria-hidden>👑</span>
                      <span>Elite Club</span>
                    </NavLink>
                    <button
                      type="button"
                      className="en-mobile-drawer__link"
                      onClick={() => {
                        onClose();
                        onLogout();
                      }}
                    >
                      <span className="en-mobile-drawer__emoji" aria-hidden>↩</span>
                      <span>Log out</span>
                    </button>
                  </>
                ) : (
                  <>
                    <NavLink to={paths.login()} className="en-mobile-drawer__link" onClick={onClose}>
                      <span className="en-mobile-drawer__emoji" aria-hidden>👤</span>
                      <span>Sign in</span>
                    </NavLink>
                    <NavLink to={paths.register()} className="en-mobile-drawer__link" onClick={onClose}>
                      <span className="en-mobile-drawer__emoji" aria-hidden>✨</span>
                      <span>Create account</span>
                    </NavLink>
                    <NavLink to={paths.membership()} className="en-mobile-drawer__link" onClick={onClose}>
                      <span className="en-mobile-drawer__emoji" aria-hidden>👑</span>
                      <span>Elite Club</span>
                    </NavLink>
                  </>
                )}
              </div>

              {/* Utilities */}
              <div className="en-mobile-drawer__section">
                <p className="en-mobile-drawer__section-title">More</p>
                {UTILITY_LINKS.map((link) => (
                  <NavLink
                    key={link.label}
                    to={link.to}
                    className="en-mobile-drawer__link"
                    onClick={onClose}
                  >
                    <span className="en-mobile-drawer__emoji" aria-hidden>{link.emoji}</span>
                    <span>{link.label}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

// ── Header component ────────────────────────────────────────
export function Header(): JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, logout } = useAuth();
  const { itemCount, isLoading: cartLoading } = useCart();
  const cartDrawer = useCartDrawer();

  // Bounce the cart icon once whenever the item count increments — but skip
  // the initial fetch-in so a page load doesn't feel like an "add".
  const cartControls = useAnimationControls();
  const reduceMotion = useReducedMotion();
  const prevCountRef = useRef(itemCount);
  const cartSettledRef = useRef(false);
  useEffect(() => {
    if (!cartSettledRef.current) {
      if (!cartLoading) {
        cartSettledRef.current = true;
        prevCountRef.current = itemCount;
      }
      return;
    }
    const prev = prevCountRef.current;
    prevCountRef.current = itemCount;
    if (reduceMotion) return;
    if (itemCount > prev) {
      void cartControls.start({
        scale: [1, 1.32, 0.94, 1.08, 1],
        transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
      });
    }
  }, [itemCount, cartLoading, cartControls, reduceMotion]);

  const [shopOpen, setShopOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [pincodeModalOpen, setPincodeModalOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const { record: serviceability } = useServiceability();
  const pincodeLabel = serviceability?.pincode ?? STORE.CITY;
  const isNotServiceable = serviceability !== null && !serviceability.serviceable;

  // Data feeds for the megamenu — both queries cache app-wide, so opening
  // the menu after the Home page has rendered is instant.
  const { data: categoriesData } = useCategories();
  const { data: featuredData } = useFeaturedProducts();
  const { data: banners } = useBanners(PROMO_BANNER_POSITION);
  const navCategories = useMemo(() => toNavShape(categoriesData), [categoriesData]);
  // Menu shows the first 6 top-level cuts to avoid an overflowing column.
  const navCategoriesForMenu = useMemo(() => navCategories.slice(0, 6), [navCategories]);
  const promoBanner = useMemo(() => {
    const active = banners?.filter((b) => b.isActive) ?? [];
    return active.length > 0 ? active[0] : null;
  }, [banners]);

  // Refs used by outside-click handlers.
  const searchWrapRef = useRef<HTMLFormElement>(null);
  const shopRef = useRef<HTMLDivElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);

  // Close the search dropdown when clicking outside the search form.
  useEffect(() => {
    if (!searchOpen) return;
    const handler = (e: MouseEvent): void => {
      if (!searchWrapRef.current) return;
      if (!searchWrapRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [searchOpen]);

  // Close megamenu / account on Escape, or on a mousedown outside their region.
  useEffect(() => {
    if (!shopOpen && !accountOpen) return;
    const onKey = (e: globalThis.KeyboardEvent): void => {
      if (e.key === 'Escape') {
        setShopOpen(false);
        setAccountOpen(false);
      }
    };
    const onDown = (e: MouseEvent): void => {
      const target = e.target as Node;
      if (shopOpen && shopRef.current && !shopRef.current.contains(target)) {
        setShopOpen(false);
      }
      if (accountOpen && accountRef.current && !accountRef.current.contains(target)) {
        setAccountOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [shopOpen, accountOpen]);

  // Clear the search field + close every panel whenever we navigate.
  useEffect(() => {
    setSearchOpen(false);
    setSearchFocused(false);
    setQuery('');
    setShopOpen(false);
    setAccountOpen(false);
    setMobileNavOpen(false);
  }, [location.pathname, location.search]);

  const onSearch = (e: FormEvent): void => {
    e.preventDefault();
    const q = query.trim();
    if (q.length === 0) return;
    setSearchOpen(false);
    navigate(paths.search(q));
  };

  const onSearchKey = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Escape') {
      setSearchOpen(false);
      (e.currentTarget as HTMLInputElement).blur();
    }
  };

  const displayName = user?.name.split(' ')[0] ?? 'Account';
  const initials = user ? initialsFor(user.name) : '';

  return (
    <>
      <header className={`en-header${searchFocused ? ' is-search-focused' : ''}`}>
        {/* ── Primary row ─────────────────────────────────────── */}
        <div className="en-header__row">
          <div className="en-container d-flex align-items-center gap-3">
            {/* Hamburger — mobile only */}
            <button
              type="button"
              className="en-hamburger d-inline-grid d-md-none"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open navigation"
              aria-expanded={mobileNavOpen}
            >
              <svg viewBox="0 0 24 24" aria-hidden>
                <line x1="4" y1="7" x2="20" y2="7" />
                <line x1="4" y1="12" x2="20" y2="12" />
                <line x1="4" y1="17" x2="20" y2="17" />
              </svg>
            </button>

            {/* Brand */}
            <Link to={paths.home()} className="en-logo en-link-reset flex-shrink-0">
              Elite<span className="en-logo__accent">NonVeg</span>
            </Link>

            {/* Primary nav — Shop megamenu trigger */}
            <nav className="d-none d-lg-flex align-items-center gap-1">
              <div
                ref={shopRef}
                className="position-static"
                onMouseEnter={() => setShopOpen(true)}
                onMouseLeave={() => setShopOpen(false)}
              >
                <ShopTrigger
                  open={shopOpen}
                  onToggle={() => setShopOpen((v) => !v)}
                />
              </div>
            </nav>

            {/* Search */}
            <form
              ref={searchWrapRef}
              className="en-search mx-auto position-relative"
              onSubmit={onSearch}
              role="search"
            >
              <span aria-hidden style={{ opacity: 0.6 }}>🔍</span>
              <input
                type="search"
                placeholder="Search chicken, prawns, kebabs…"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSearchOpen(true);
                }}
                onFocus={() => {
                  setSearchOpen(true);
                  setSearchFocused(true);
                }}
                onBlur={() => setSearchFocused(false)}
                onKeyDown={onSearchKey}
                aria-label="Search products"
                aria-autocomplete="list"
                aria-expanded={searchOpen}
                autoComplete="off"
              />
              {searchOpen && query.trim().length > 0 && (
                <SearchDropdown query={query} onClose={() => setSearchOpen(false)} />
              )}
            </form>

            {/* Pincode serviceability */}
            <button
              type="button"
              className={`en-pincode-pill d-none d-md-inline-flex flex-shrink-0${
                isNotServiceable ? ' text-danger border-danger' : ''
              }`}
              onClick={() => setPincodeModalOpen(true)}
              aria-haspopup="dialog"
              aria-label={
                serviceability
                  ? `Delivering to pincode ${serviceability.pincode}. Change delivery pincode.`
                  : 'Check delivery to your pincode'
              }
            >
              <span aria-hidden>📍</span>
              Deliver to{' '}
              <strong className={isNotServiceable ? 'text-danger' : 'text-white'}>
                {pincodeLabel}
              </strong>
            </button>

            {/* Account menu */}
            <div
              ref={accountRef}
              className="position-relative flex-shrink-0"
              onMouseEnter={() => setAccountOpen(true)}
              onMouseLeave={() => setAccountOpen(false)}
            >
              {isAuthenticated ? (
                <button
                  type="button"
                  className="en-avatar"
                  onClick={() => setAccountOpen((v) => !v)}
                  aria-haspopup="menu"
                  aria-expanded={accountOpen}
                  aria-label={`Account menu for ${user?.name ?? 'you'}`}
                >
                  {initials}
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm d-flex align-items-center gap-2"
                  onClick={() => setAccountOpen((v) => !v)}
                  aria-haspopup="menu"
                  aria-expanded={accountOpen}
                >
                  <span aria-hidden>👤</span>
                  <span className="d-none d-xl-inline">Sign in</span>
                </button>
              )}
              <AnimatePresence>
                {accountOpen && (
                  <motion.div
                    className="en-megamenu"
                    style={{ left: 'auto', right: 0, minWidth: 220 }}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{ duration: 0.18 }}
                    role="menu"
                  >
                    {isAuthenticated ? (
                      <div className="d-flex flex-column gap-1">
                        <div className="px-2 pt-1 pb-2">
                          <div className="fw-semibold" style={{ fontSize: '0.9rem' }}>
                            Hi, {displayName}
                          </div>
                          {user?.email && (
                            <div className="en-text-muted small text-truncate">{user.email}</div>
                          )}
                        </div>
                        <hr className="en-divider my-1" />
                        <Link to={paths.account()} className="dropdown-item rounded" role="menuitem">
                          Account
                        </Link>
                        <Link to={paths.orders()} className="dropdown-item rounded" role="menuitem">
                          Orders
                        </Link>
                        <Link to={paths.wishlist()} className="dropdown-item rounded" role="menuitem">
                          Wishlist
                        </Link>
                        <Link to={paths.addresses()} className="dropdown-item rounded" role="menuitem">
                          Addresses
                        </Link>
                        <Link to={paths.membership()} className="dropdown-item rounded" role="menuitem">
                          Membership
                        </Link>
                        <hr className="en-divider my-2" />
                        <button
                          type="button"
                          className="dropdown-item rounded text-start"
                          role="menuitem"
                          onClick={() => {
                            void logout();
                            setAccountOpen(false);
                          }}
                        >
                          Logout
                        </button>
                      </div>
                    ) : (
                      <div className="d-flex flex-column gap-2">
                        <Link to={paths.login()} className="btn btn-gold btn-sm">
                          Sign in
                        </Link>
                        <Link to={paths.register()} className="btn btn-outline-cream btn-sm">
                          Create account
                        </Link>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Cart */}
            <motion.button
              type="button"
              className="btn btn-ghost btn-sm en-cart-btn flex-shrink-0"
              onClick={cartDrawer.open}
              aria-label={`Cart, ${itemCount} items`}
              aria-haspopup="dialog"
              aria-expanded={cartDrawer.isOpen}
              data-cart-icon
              data-cart-target
              animate={cartControls}
              style={{ transformOrigin: '50% 50%' }}
            >
              <span aria-hidden style={{ fontSize: '1.1rem' }}>🛒</span>
              {itemCount > 0 && (
                // The `key` forces a remount whenever the count changes, which
                // (re-)runs the `en-cart-pulse` keyframe declared in the SCSS.
                <span key={itemCount} className="en-cart-btn__count">
                  {itemCount}
                </span>
              )}
            </motion.button>
          </div>

          {/* Megamenu — hangs off the primary row so it spans full width */}
          <AnimatePresence>
            {shopOpen && (
              <div
                className="en-container position-absolute start-0 end-0"
                style={{ top: '100%', left: 0, right: 0 }}
                onMouseEnter={() => setShopOpen(true)}
                onMouseLeave={() => setShopOpen(false)}
              >
                <Megamenu
                  categories={navCategoriesForMenu}
                  featured={featuredData ?? []}
                  promoImageUrl={promoBanner?.imageUrl ?? null}
                  promoTitle={promoBanner?.title ?? null}
                  promoLink={promoBanner?.link ?? null}
                  onNavigate={() => setShopOpen(false)}
                />
              </div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Persistent category strip (≥md) ────────────────── */}
        <div className="en-category-strip d-none d-md-flex">
          <div className="en-container en-category-strip__inner">
            <nav className="en-category-strip__nav" aria-label="Categories">
              {navCategories.slice(0, 7).map((cat) => (
                <NavLink
                  key={cat.id}
                  to={paths.category(cat.slug)}
                  className={({ isActive }) =>
                    `en-category-strip__link${isActive ? ' is-active' : ''}`
                  }
                >
                  {cat.name}
                </NavLink>
              ))}
            </nav>
            <Link to={paths.collections()} className="en-category-strip__pill en-category-strip__pill--gold"><span aria-hidden>🥩</span>Boxes</Link>
            <Link to={UTILITY_LINKS[0].to} className="en-category-strip__cta">
              <span aria-hidden>{UTILITY_LINKS[0].emoji}</span>
              {UTILITY_LINKS[0].label}
            </Link>
            <Link to={UTILITY_LINKS[1].to} className="en-category-strip__pill">
              <span aria-hidden>{UTILITY_LINKS[1].emoji}</span>
              {UTILITY_LINKS[1].label}
            </Link>
          </div>
        </div>
      </header>

      <ServiceabilityModal
        open={pincodeModalOpen}
        onClose={() => setPincodeModalOpen(false)}
      />

      <MobileDrawer
        open={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        categories={navCategories}
        isAuthenticated={isAuthenticated}
        userName={user?.name.split(' ')[0] ?? null}
        pincode={serviceability?.pincode ?? null}
        onChangePincode={() => setPincodeModalOpen(true)}
        onLogout={() => {
          void logout();
        }}
      />

      <CartDrawer />
    </>
  );
}

// Silence "unused" on `NavCategory` — keep the import for downstream tooling
// that grep-imports the type from this file's neighbours.
export type { NavCategory };
