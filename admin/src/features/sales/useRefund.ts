import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useToast } from '@/components/ui';
import { getApiErrorMessage } from '@/lib/apiClient';

import { refundPayment, type RefundPaymentInput, type RefundResult } from './refund.api';
import { salesKeys } from './sales.queries';

interface RefundVars {
  /** Gateway payment id to refund against. */
  paymentId: string;
  /** Order code — used to invalidate the detail query on success. */
  orderCode: string;
  /** Refund body forwarded to the API. */
  input: RefundPaymentInput;
}

/**
 * React Query mutation for issuing a refund on an order's payment. Invalidates
 * the affected order (and the orders list) so the payment status/badge refresh
 * without a manual reload. Toasts on both success and failure.
 */
export function useRefund() {
  const qc = useQueryClient();
  const toast = useToast();

  return useMutation<RefundResult, unknown, RefundVars>({
    mutationFn: ({ paymentId, input }) => refundPayment(paymentId, input),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: salesKeys.orders });
      qc.invalidateQueries({ queryKey: salesKeys.order(vars.orderCode) });
      toast.success({ title: 'Refund processed' });
    },
    onError: (err) =>
      toast.error({
        title: 'Refund failed',
        message: getApiErrorMessage(err),
      }),
  });
}
