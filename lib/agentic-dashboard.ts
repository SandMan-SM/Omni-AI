/**
 * Canonical operator-facing command center.
 *
 * Omni may host internal ingestion and legacy account surfaces, but owner
 * notifications and operator reporting always open Mythos.
 */
export const AGENTIC_DASHBOARD_URL =
  process.env.AGENTIC_DASHBOARD_URL?.trim() ||
  'https://mythosais.com/dashboard';

export const AGENTIC_DASHBOARD_LABEL = 'mythosais.com/dashboard';
