import { asyncHandler, created, ok } from '../../utils/http.js';

import type { CustomersQuery } from './user.schema.js';
import { userService } from './user.service.js';

/** Thin controllers: delegate to the service, shape the envelope. */
export const userController = {
  getProfile: asyncHandler(async (req, res) => {
    return ok(res, await userService.getProfile(req.user!.id));
  }),

  updateProfile: asyncHandler(async (req, res) => {
    return ok(res, await userService.updateProfile(req.user!.id, req.body), 'Profile updated');
  }),

  listAddresses: asyncHandler(async (req, res) => {
    return ok(res, await userService.listAddresses(req.user!.id));
  }),

  createAddress: asyncHandler(async (req, res) => {
    return created(res, await userService.createAddress(req.user!.id, req.body), 'Address added');
  }),

  updateAddress: asyncHandler(async (req, res) => {
    const address = await userService.updateAddress(req.user!.id, req.params.id, req.body);
    return ok(res, address, 'Address updated');
  }),

  deleteAddress: asyncHandler(async (req, res) => {
    await userService.deleteAddress(req.user!.id, req.params.id);
    return ok(res, { id: req.params.id }, 'Address removed');
  }),

  setDefaultAddress: asyncHandler(async (req, res) => {
    const address = await userService.setDefaultAddress(req.user!.id, req.params.id);
    return ok(res, address, 'Default address set');
  }),

  listCustomers: asyncHandler(async (req, res) => {
    const result = await userService.listCustomers(req.query as unknown as CustomersQuery);
    return ok(res, result);
  }),

  getCustomer: asyncHandler(async (req, res) => {
    return ok(res, await userService.getCustomer(req.params.id));
  }),
};
