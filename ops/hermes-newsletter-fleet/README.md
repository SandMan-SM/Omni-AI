# Hermes newsletter fleet safeguards

These scripts protect agent-backed portfolio newsletter draft jobs without
changing their publication or delivery scope.

- `newsletter-runtime-preflight.py` is attached to each agent-backed
  newsletter job. It starts Docker Desktop when necessary and verifies the
  artifact directory and validator before the model begins.
- `newsletter-runtime-watchdog.py` runs every fifteen minutes during the active
  newsletter window. Healthy checks are silent; recovery and failure are
  delivered as receipts.
- `newsletter-fleet-monitor.py` replaces the model-based evening verifier. It
  checks scheduler evidence, the exact expected artifact, and the real
  validator exit code. If a model cannot use the safe filesystem writer, the
  monitor can recover only an explicitly marked full-draft fallback and then
  runs the same validator. Any unrecoverable missing artifact remains a
  non-zero job failure even when the original model run was recorded as `ok`.
- `portfolio-seo-newsletter-engine.mjs` preserves the portfolio-wide draft
  engine while explicitly excluding North Peak Roofing and Mafi Rentals from
  discovery and generation.

The monitor writes only a missing canonical local draft from a marked Hermes
response. It never publishes, deploys, emails subscribers, or changes Utah
Main Street.
