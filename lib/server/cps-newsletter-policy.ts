const CLEARABLE_REOPT_IN_REASONS = new Set(['unsubscribe']);

/**
 * Only suppressions created by an explicit unsubscribe may be cleared by a
 * fresh CPS signup. Delivery failures, complaints, and operator blocks always
 * require manual review.
 */
export function isClearableCpsReoptInSuppression(reason: unknown): boolean {
  if (typeof reason !== 'string') return false;
  return CLEARABLE_REOPT_IN_REASONS.has(reason.trim().toLowerCase());
}

/**
 * State recorded after Resend accepted a welcome but the active transition
 * could not be confirmed. Keeping the provider ID makes manual reconciliation
 * possible without risking a send after Resend's idempotency window expires.
 */
export function cpsWelcomeAcceptanceUnknownState(messageId: string) {
  return {
    welcome_status: 'unknown' as const,
    welcome_message_id: messageId,
    welcome_error_code: 'welcome_acceptance_persist_failed',
  };
}

export function cpsOwnerAcceptanceUnknownState(messageId: string) {
  return {
    owner_status: 'unknown' as const,
    owner_message_id: messageId,
    owner_error_code: 'owner_acceptance_persist_failed',
  };
}

export function cpsEmailProviderFailure(
  prefix: 'welcome' | 'owner',
  status: number,
  providerErrorName: string,
) {
  const concurrentIdempotentRequest =
    status === 409 &&
    providerErrorName === 'concurrent_idempotent_requests';
  return {
    retryable:
      concurrentIdempotentRequest || status >= 500 || status === 429,
    deliveryUnknown: concurrentIdempotentRequest,
    code: providerErrorName
      ? `${prefix}_provider_${providerErrorName}`
      : `${prefix}_provider_${status}`,
  };
}

