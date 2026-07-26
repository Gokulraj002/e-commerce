import { asyncHandler, created, ok } from '../../utils/http.js';

import { authService } from './auth.service.js';

/** Thin controllers: delegate to the service, shape the envelope. */
export const authController = {
  register: asyncHandler(async (req, res) => {
    const result = await authService.register(req.body);
    return created(res, result, 'Account created');
  }),

  login: asyncHandler(async (req, res) => {
    const result = await authService.login(req.body);
    return ok(res, result, 'Logged in');
  }),

  refresh: asyncHandler(async (req, res) => {
    const tokens = await authService.refresh(req.body.refreshToken);
    return ok(res, tokens, 'Token refreshed');
  }),

  logout: asyncHandler(async (req, res) => {
    await authService.logout(req.body.refreshToken);
    return ok(res, { revoked: true }, 'Logged out');
  }),

  me: asyncHandler(async (req, res) => {
    const user = await authService.me(req.user!.id);
    return ok(res, user);
  }),
};
