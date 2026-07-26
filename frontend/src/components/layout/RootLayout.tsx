import { useEffect } from 'react';
import { Outlet, ScrollRestoration, useLocation } from 'react-router-dom';

import { Footer } from './Footer';
import { Header } from './Header';

/** App shell shared by every route: sticky header, page outlet, footer. */
export function RootLayout(): JSX.Element {
  const { pathname } = useLocation();

  // Belt-and-braces scroll reset on navigation (ScrollRestoration handles most).
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);

  return (
    <div className="d-flex flex-column min-vh-100">
      <Header />
      <main className="flex-grow-1">
        <Outlet />
      </main>
      <Footer />
      <ScrollRestoration />
    </div>
  );
}
