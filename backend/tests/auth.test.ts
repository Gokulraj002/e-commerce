/**
 * Integration tests for the /auth surface.
 *
 * Requires a running test database — set `DATABASE_URL_TEST` before
 * `vitest run`. Without it, the whole suite is skipped so `vitest run` still
 * succeeds on machines that only have unit-test infra.
 */
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, test } from 'vitest';

import { buildApp, truncateAll } from './setup.js';

const hasTestDb = Boolean(process.env.DATABASE_URL_TEST);

describe.skipIf(!hasTestDb)('/api/v1/auth', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
  });

  beforeEach(async () => {
    await truncateAll();
  });

  const creds = {
    name: 'Anjali Reddy',
    phone: '+919000000010',
    email: 'anjali@example.com',
    password: 'Password@123',
  };

  test('POST /register creates an account and returns an access+refresh pair', async () => {
    const res = await request(app).post('/api/v1/auth/register').send(creds);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.phone).toBe(creds.phone);
    expect(res.body.data.user.email).toBe(creds.email);
    expect(res.body.data.user.role).toBe('CUSTOMER');
    expect(typeof res.body.data.tokens.accessToken).toBe('string');
    expect(typeof res.body.data.tokens.refreshToken).toBe('string');
  });

  test('POST /login accepts phone OR email; wrong password is rejected', async () => {
    await request(app).post('/api/v1/auth/register').send(creds).expect(201);

    const byPhone = await request(app)
      .post('/api/v1/auth/login')
      .send({ phone: creds.phone, password: creds.password });
    expect(byPhone.status).toBe(200);
    expect(byPhone.body.data.user.phone).toBe(creds.phone);
    expect(typeof byPhone.body.data.tokens.accessToken).toBe('string');

    const byEmail = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: creds.email, password: creds.password });
    expect(byEmail.status).toBe(200);
    expect(byEmail.body.data.user.id).toBe(byPhone.body.data.user.id);

    const bad = await request(app)
      .post('/api/v1/auth/login')
      .send({ phone: creds.phone, password: 'WrongPassword!' });
    expect(bad.status).toBe(401);
    expect(bad.body.success).toBe(false);
  });

  test('GET /me returns the authenticated user', async () => {
    const reg = await request(app).post('/api/v1/auth/register').send(creds).expect(201);
    const accessToken = reg.body.data.tokens.accessToken as string;

    const me = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(me.status).toBe(200);
    expect(me.body.data.id).toBe(reg.body.data.user.id);
    expect(me.body.data.phone).toBe(creds.phone);
    expect(me.body.data.email).toBe(creds.email);

    // Without the token /me is 401.
    const anon = await request(app).get('/api/v1/auth/me');
    expect(anon.status).toBe(401);
  });

  test('POST /refresh rotates the refresh token and revokes the old one', async () => {
    const reg = await request(app).post('/api/v1/auth/register').send(creds).expect(201);
    const oldRefresh = reg.body.data.tokens.refreshToken as string;

    const rotated = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: oldRefresh });
    expect(rotated.status).toBe(200);
    expect(typeof rotated.body.data.accessToken).toBe('string');
    expect(typeof rotated.body.data.refreshToken).toBe('string');
    expect(rotated.body.data.refreshToken).not.toBe(oldRefresh);

    // Replaying the (now-revoked) refresh token must fail.
    const replay = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: oldRefresh });
    expect(replay.status).toBe(401);
  });
});
