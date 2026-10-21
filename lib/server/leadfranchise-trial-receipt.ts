/** Receipt identity for the authenticated Lead Franchise website trial caller. */
export const LEADFRANCHISE_TRIAL_SOURCE = 'website_trial_application';

const INTAKE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
// The public caller creates submission identities with crypto.randomUUID().
const SUBMISSION_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type TrialReceipt =
  | { ok: true; intakeId: string; submissionId: string; dedupKey: string }
  | { ok: false; code: 'trial_intake_id_required' | 'trial_submission_id_required' | 'trial_submission_id_mismatch' };

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function uuid(value: unknown, pattern: RegExp): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return pattern.test(normalized) ? normalized : null;
}

export function leadfranchiseTrialReceipt(value: unknown): TrialReceipt {
  const body = record(value);
  const intakeId = uuid(body.intake_id, INTAKE_UUID);
  if (!intakeId) return { ok: false, code: 'trial_intake_id_required' };

  const application = record(body.application);
  const submissionId = uuid(application.submission_id, SUBMISSION_UUID);
  const envelopeId = uuid(body.submission_id, SUBMISSION_UUID);
  if (!submissionId || !envelopeId) {
    return { ok: false, code: 'trial_submission_id_required' };
  }
  if (submissionId !== envelopeId) {
    return { ok: false, code: 'trial_submission_id_mismatch' };
  }

  // An intake is one durable application receipt, not one email address.
  // Replaying it retains the analytics ID and notification idempotency key.
  // A new application receipt gets a new lead while CRM still links by email.
  return {
    ok: true,
    intakeId,
    submissionId,
    dedupKey: `website-trial:${intakeId}`,
  };
}
