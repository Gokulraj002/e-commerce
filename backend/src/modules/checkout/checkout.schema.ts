import { PAYMENT_METHOD } from '@elite/shared';
import { z } from 'zod';

/** GET /summary?addressId=&slotId= */
export const summaryQuerySchema = z.object({
  addressId: z.string().min(1),
  slotId: z.string().min(1).optional(),
});

/** POST /place */
export const placeOrderSchema = z.object({
  addressId: z.string().min(1),
  slotId: z.string().min(1).optional(),
  paymentMethod: z.enum([
    PAYMENT_METHOD.RAZORPAY,
    PAYMENT_METHOD.PHONEPE,
    PAYMENT_METHOD.CASHFREE,
    PAYMENT_METHOD.COD,
  ]),
  note: z.string().max(500).optional(),
});

export type SummaryQueryInput = z.infer<typeof summaryQuerySchema>;
export type PlaceOrderInput = z.infer<typeof placeOrderSchema>;
