import { Route, Routes } from 'react-router-dom';
import { ROLES } from '@elite/shared';

import { AdminLayout } from '@/components/layout';
import { ProtectedRoute } from '@/features/auth';
import { ROUTES } from '@/routes/paths';

// Pages
import Dashboard from '@/pages/Dashboard/Dashboard';
import Products from '@/pages/Products/Products';
import ProductForm from '@/pages/ProductForm/ProductForm';
import Categories from '@/pages/Categories/Categories';
import Brands from '@/pages/Brands/Brands';
import Attributes from '@/pages/Attributes/Attributes';
import InventoryStock from '@/pages/InventoryStock/InventoryStock';
import Purchases from '@/pages/Purchases/Purchases';
import Suppliers from '@/pages/Suppliers/Suppliers';
import Warehouses from '@/pages/Warehouses/Warehouses';
import Orders from '@/pages/Orders/Orders';
import OrderDetail from '@/pages/OrderDetail/OrderDetail';
import Coupons from '@/pages/Coupons/Coupons';
import DeliveryBoard from '@/pages/DeliveryBoard/DeliveryBoard';
import DeliveryZones from '@/pages/DeliveryZones/DeliveryZones';
import DeliverySlots from '@/pages/DeliverySlots/DeliverySlots';
import DeliveryPartners from '@/pages/DeliveryPartners/DeliveryPartners';
import Customers from '@/pages/Customers/Customers';
import CustomerDetail from '@/pages/CustomerDetail/CustomerDetail';
import Reviews from '@/pages/Reviews/Reviews';
import CmsPages from '@/pages/CmsPages/CmsPages';
import Banners from '@/pages/Banners/Banners';
import Reports from '@/pages/Reports/Reports';
import Settings from '@/pages/Settings/Settings';
import Roles from '@/pages/Roles/Roles';
import Login from '@/pages/Login/Login';
import NotFound from '@/pages/NotFound/NotFound';

const ADMINS = [ROLES.SUPER_ADMIN, ROLES.ADMIN];

/**
 * Route table. Public login sits outside the guard; everything else lives
 * under <ProtectedRoute> (staff-only) inside <AdminLayout>. Admin-only areas
 * add a second role-scoped guard.
 */
export function AppRouter() {
  return (
    <Routes>
      <Route path={ROUTES.login} element={<Login />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AdminLayout />}>
          <Route index element={<Dashboard />} />

          {/* Catalog */}
          <Route path={ROUTES.products} element={<Products />} />
          <Route path={ROUTES.productNew} element={<ProductForm />} />
          <Route path={ROUTES.productEdit()} element={<ProductForm />} />
          <Route path={ROUTES.categories} element={<Categories />} />
          <Route path={ROUTES.brands} element={<Brands />} />
          <Route path={ROUTES.attributes} element={<Attributes />} />

          {/* Inventory */}
          <Route path={ROUTES.inventoryStock} element={<InventoryStock />} />
          <Route path={ROUTES.purchases} element={<Purchases />} />
          <Route path={ROUTES.suppliers} element={<Suppliers />} />
          <Route path={ROUTES.warehouses} element={<Warehouses />} />

          {/* Sales */}
          <Route path={ROUTES.orders} element={<Orders />} />
          <Route path={ROUTES.orderDetail()} element={<OrderDetail />} />
          <Route path={ROUTES.coupons} element={<Coupons />} />

          {/* Delivery */}
          <Route path={ROUTES.deliveryBoard} element={<DeliveryBoard />} />
          <Route path={ROUTES.deliveryZones} element={<DeliveryZones />} />
          <Route path={ROUTES.deliverySlots} element={<DeliverySlots />} />
          <Route path={ROUTES.deliveryPartners} element={<DeliveryPartners />} />

          {/* Customers & Reviews */}
          <Route path={ROUTES.customers} element={<Customers />} />
          <Route path={ROUTES.customerDetail()} element={<CustomerDetail />} />
          <Route path={ROUTES.reviews} element={<Reviews />} />

          {/* CMS */}
          <Route path={ROUTES.cmsPages} element={<CmsPages />} />
          <Route path={ROUTES.banners} element={<Banners />} />

          {/* Reports */}
          <Route path={ROUTES.reports} element={<Reports />} />

          {/* Admin-only */}
          <Route element={<ProtectedRoute roles={ADMINS} />}>
            <Route path={ROUTES.settings} element={<Settings />} />
            <Route path={ROUTES.roles} element={<Roles />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Route>
      </Route>
    </Routes>
  );
}
