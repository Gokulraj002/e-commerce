import type { LoginInput, RegisterInput } from '@elite/shared';

export type { LoginInput, RegisterInput };

/** Freshly-issued token pair (mirrors @elite/shared AuthTokens). */
export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
}
