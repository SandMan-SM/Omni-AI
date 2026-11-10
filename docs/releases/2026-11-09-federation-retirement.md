# Federation member retirement

Retirement removes an identity from active federation services while retaining
historical records, provider receipts, source snapshots and recovery evidence.
The database authority is the service-role-only `federation.retired_tenants`
table. Its registry/intake/reactivation guards are maintained by the operator.
The checked-in `lib/retired-federation-tenants.json` is a deny-list backstop for
database outages and stale registry caches; it does not grant access or replace
`federation.surfaces` as deployment authority.

Identity checks run before intake writes, sender fallback, newsletter generation
and public reads. Active portfolio/domain/newsletter/sponsor/cross-promotion
projections omit retired identities. The metadata extractor also denies them
before evaluating source modules, so retaining an old registry export cannot
regenerate a retired newsletter source.

Exact contact hashes, social row IDs and known media references are isolated in
`lib/server/retired-federation-contacts.json` behind a `server-only` import.
Contact matching hashes the trimmed lowercase email using SHA256. Active CRM,
subscriber and export projections omit hash matches and records marked with
`raw_data.federation_retirement`. Re-enrollment, reactivation, outreach and
newsletter sending stop before a database/provider action. Historical accepted,
unknown and in-flight provider receipts must never be relabeled as successful or
deleted to implement retirement.

`lib/retired-federation-publications.json` holds stable source/slug tombstones
for a retired member's promotional articles hosted by another active tenant.
The newsletter runtime and extractor apply the same exclusions. Removing
outbound publication cards does not justify subtracting unrelated native issues.

For the November 9 removal, the registry-derived source capture deliberately
uses the operator-authorized pending AIS and Mafi removal snapshots. The
operator receipt records both registered and pending source paths/commits. The
catalog contains 53 tenant metadata sources and 310 static issues; the real
read-only database projection observed 984 issues across 28 newsletter channels,
including 26 General News issues. The removed Liz source held 11 issues; Mafi
held one promotional article. AIS's 13 removed outbound cards reference Liz's
site and are not 13 additional native AIS issues. The two-row difference from
the earlier 982 arithmetic is a separate free/premium draft pair created after
the previous rollout snapshot; those unrelated drafts are preserved.

Operator evidence and guarded launcher are in
`docs/plans/liz-federation-removal-20261109/` in the shared client workspace.
Read fresh federation authority and the last five changes before release,
require the active lease and exact clean commit, and use the guarded deploy
runner with existing app configuration in process only. After release verify
the normal canonical AIS owner flow, negative retired identity routes, active
source/tag/Content Studio projections, unaffected public routes and preserved
historical database/provider state. No messaging is authorized by this runbook.
