import { Router } from 'express';

import { authRouter } from '../modules/auth/auth.routes.js';
import { cartRouter } from '../modules/cart/cart.routes.js';
import { catalogRouter } from '../modules/catalog/catalog.routes.js';
import { checkoutRouter } from '../modules/checkout/checkout.routes.js';
import { cmsRouter } from '../modules/cms/cms.routes.js';
import { couponRouter } from '../modules/coupon/coupon.routes.js';
import { dashboardRouter } from '../modules/dashboard/dashboard.routes.js';
import { deliveryRouter } from '../modules/delivery/delivery.routes.js';
import { healthRouter } from '../modules/health/health.routes.js';
import { inventoryRouter } from '../modules/inventory/inventory.routes.js';
import { notificationRouter } from '../modules/notification/notification.routes.js';
import { orderRouter } from '../modules/order/order.routes.js';
import { paymentRouter } from '../modules/payment/payment.routes.js';
import { reviewRouter } from '../modules/review/review.routes.js';
import { settingsRouter } from '../modules/settings/settings.routes.js';
import { userRouter } from '../modules/user/user.routes.js';
import { wishlistRouter } from '../modules/wishlist/wishlist.routes.js';

export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/catalog', catalogRouter);
apiRouter.use('/cart', cartRouter);
apiRouter.use('/wishlist', wishlistRouter);
apiRouter.use('/coupons', couponRouter);
apiRouter.use('/checkout', checkoutRouter);
apiRouter.use('/orders', orderRouter);
apiRouter.use('/payments', paymentRouter);
apiRouter.use('/delivery', deliveryRouter);
apiRouter.use('/inventory', inventoryRouter);
apiRouter.use('/reviews', reviewRouter);
apiRouter.use('/users', userRouter);
apiRouter.use('/cms', cmsRouter);
apiRouter.use('/settings', settingsRouter);
apiRouter.use('/notifications', notificationRouter);
apiRouter.use('/dashboard', dashboardRouter);
