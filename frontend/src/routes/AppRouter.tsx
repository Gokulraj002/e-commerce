import { createBrowserRouter, RouterProvider } from 'react-router-dom';

import { RootLayout } from '@/components/layout/RootLayout';
import Account from '@/pages/Account/Account';
import Addresses from '@/pages/Addresses/Addresses';
import Cart from '@/pages/Cart/Cart';
import Category from '@/pages/Category/Category';
import Checkout from '@/pages/Checkout/Checkout';
import CmsPage from '@/pages/CmsPage/CmsPage';
import CollectionDetail from '@/pages/Collections/CollectionDetail';
import Collections from '@/pages/Collections/Collections';
import Home from '@/pages/Home/Home';
import Login from '@/pages/Login/Login';
import Membership from '@/pages/Membership/Membership';
import NotFound from '@/pages/NotFound/NotFound';
import OrderSuccess from '@/pages/OrderSuccess/OrderSuccess';
import OrderTracking from '@/pages/OrderTracking/OrderTracking';
import Orders from '@/pages/Orders/Orders';
import ProductDetail from '@/pages/ProductDetail/ProductDetail';
import Register from '@/pages/Register/Register';
import Search from '@/pages/Search/Search';
import Wishlist from '@/pages/Wishlist/Wishlist';

import { RouteError } from './RouteError';
import { ROUTES } from './routes';

/**
 * Application route tree. Every page lives under the shared RootLayout so the
 * header/footer persist across navigations. Paths come from ROUTES so links
 * and definitions cannot drift.
 */
const router = createBrowserRouter([
  {
    path: ROUTES.HOME,
    element: <RootLayout />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <Home /> },
      { path: ROUTES.CATEGORY, element: <Category /> },
      { path: ROUTES.PRODUCT, element: <ProductDetail /> },
      { path: ROUTES.CART, element: <Cart /> },
      { path: ROUTES.CHECKOUT, element: <Checkout /> },
      { path: ROUTES.ORDER_SUCCESS, element: <OrderSuccess /> },
      { path: ROUTES.MEMBERSHIP, element: <Membership /> },

      { path: ROUTES.ACCOUNT, element: <Account /> },
      { path: ROUTES.ORDERS, element: <Orders /> },
      { path: ROUTES.ORDER_TRACKING, element: <OrderTracking /> },
      { path: ROUTES.WISHLIST, element: <Wishlist /> },
      { path: ROUTES.ADDRESSES, element: <Addresses /> },

      { path: ROUTES.LOGIN, element: <Login /> },
      { path: ROUTES.REGISTER, element: <Register /> },

      { path: ROUTES.CMS, element: <CmsPage /> },

      { path: ROUTES.SEARCH, element: <Search /> },

      { path: ROUTES.COLLECTIONS, element: <Collections /> },
      { path: ROUTES.COLLECTION_DETAIL, element: <CollectionDetail /> },

      { path: ROUTES.NOT_FOUND, element: <NotFound /> },
    ],
  },
]);

export function AppRouter(): JSX.Element {
  return <RouterProvider router={router} />;
}
