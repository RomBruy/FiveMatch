# Infrastructure Cost Register

Status: Phase 8 planning template; no purchase or provisioning approved
Last reviewed: 2026-08-06

Prices, free tiers, taxes and exchange rates change. Every figure must be verified from the selected provider's current official pricing and the owner-controlled billing console during Phase 8. `TBD` is deliberate; repository references are not pricing evidence and a missing invoice does not mean a service is free.

## 1. Cost comparison inputs

Complete one workload worksheet and use it for both hosting options:

| Input | Current/local estimate | 1,000 active users | 10,000 active users | Evidence/date |
|---|---:|---:|---:|---|
| Monthly active users | TBD | 1,000 | 10,000 | TBD |
| API requests/month | TBD | TBD | TBD | TBD |
| Peak API requests/second | TBD | TBD | TBD | TBD |
| PostgreSQL storage | TBD | TBD | TBD | TBD |
| Backup storage/egress | TBD | TBD | TBD | TBD |
| Source/generated image storage | TBD | TBD | TBD | TBD |
| Image transformations/month | TBD | TBD | TBD | TBD |
| Moderation requests/month | TBD | TBD | TBD | TBD |
| Push notifications/month | TBD | TBD | TBD | TBD |
| Analytics events/month | TBD | TBD | TBD | TBD |
| Error-monitoring events/month | TBD | TBD | TBD | TBD |
| Email messages/month | TBD | TBD | TBD | TBD |

## 2. Service cost register

All amounts must state currency and whether tax is included.

| Service/category | Selected provider/plan | Free-tier and hard limits | Current expected/month | At 1,000 active users | At 10,000 active users | Actual/month | Usage/overage risk | Billing alert | Billing owner | Verified date |
|---|---|---|---:|---:|---:|---:|---|---|---|---|
| Server/API/worker | TBD after ADR-022 | TBD | TBD | TBD | TBD | TBD | CPU, RAM, bandwidth | TBD | TBD | TBD |
| Managed PostgreSQL, if selected | TBD | TBD | TBD | TBD | TBD | TBD | storage, I/O, connections, PITR | TBD | TBD | TBD |
| Self-hosted PostgreSQL administration, if selected | Staff/contractor time TBD | No free operational labor assumption | TBD | TBD | TBD | TBD | upgrades, incidents, on-call | Budget threshold TBD | TBD | TBD |
| Database backups | TBD | TBD | TBD | TBD | TBD | TBD | retention, egress, restore | TBD | TBD | TBD |
| Object/image storage | TBD | TBD | TBD | TBD | TBD | TBD | storage, requests, egress | TBD | TBD | TBD |
| AI image generation | Disabled until approved | TBD | 0 while disabled | TBD | TBD | TBD | per-image/token billing | Required before enablement | TBD | TBD |
| Image moderation | Disabled until approved | TBD | 0 while disabled | TBD | TBD | TBD | per-image billing/logging | Required before enablement | TBD | TBD |
| Authentication | TBD | TBD | TBD | TBD | TBD | TBD | MAU/session/enterprise features | TBD | TBD | TBD |
| Transactional email | No provider selected | TBD | TBD | TBD | TBD | TBD | messages/dedicated IP | TBD | TBD | TBD |
| Push notifications | Provider chain TBD | TBD | TBD | TBD | TBD | TBD | platform/service changes | TBD | TBD | TBD |
| Analytics | TBD | TBD | TBD | TBD | TBD | TBD | events, retention, replay | TBD | TBD | TBD |
| Error monitoring/mobile crashes | TBD | TBD | TBD | TBD | TBD | TBD | events, traces, replay | TBD | TBD | TBD |
| Infrastructure monitoring/alerts | No provider selected | TBD | TBD | TBD | TBD | TBD | metrics/logs/retention | TBD | TBD | TBD |
| Domain registrar | TBD | n/a | TBD | TBD | TBD | TBD | annual renewal | Renewal + expiry alerts | TBD | TBD |
| DNS/TLS | TBD | TBD | TBD | TBD | TBD | TBD | queries/advanced security | Certificate/domain alerts | TBD | TBD |
| Apple Developer Program | TBD | Verify current annual fee | TBD | TBD | TBD | TBD | annual renewal | Renewal alert | TBD | TBD |
| Google Play Console | TBD | Verify current registration/fees | TBD | TBD | TBD | TBD | account/merchant charges | Billing alert | TBD | TBD |
| Source control/CI | TBD | TBD | TBD | TBD | TBD | TBD | seats/minutes/storage | TBD | TBD | TBD |
| Security scanning | TBD | TBD | TBD | TBD | TBD | TBD | seats/images/scans | TBD | TBD | TBD |
| Legal/privacy review | Professional provider TBD | No free assumption | TBD | TBD | TBD | TBD | scope/change requests | Budget approval | TBD | TBD |
| Operational support/on-call | Responsible person/provider TBD | No free assumption | TBD | TBD | TBD | TBD | incidents and coverage | Budget approval | TBD | TBD |

## 3. Hosting-option comparison

| Cost/control | Option A: European VPS + self-hosted PostgreSQL | Option B: API host + managed PostgreSQL |
|---|---|---|
| Base monthly infrastructure | TBD | TBD |
| Backup/PITR | Backup storage, tooling and operator time must be priced | Provider plan, retention and restore/egress must be priced |
| Administration | OS, PostgreSQL, PgBouncer, patching and incidents are owner responsibility | Provider covers defined database operations; API/worker still owner responsibility |
| Availability/failover | Single-server and manual recovery risk must be costed | Plan-specific failover/SLA must be verified and costed |
| Scaling | Vertical capacity and migration downtime must be estimated | Compute/storage/connection scaling and overages must be estimated |
| Security/monitoring | Tools plus responsible operator time | Shared-responsibility controls plus monitoring plan |
| Exit/portability | PostgreSQL dump/restore, object export and DNS cutover | PostgreSQL export/egress, version/extensions and lock-in review |
| Total current / 1k / 10k | TBD / TBD / TBD | TBD / TBD / TBD |

ADR-022 cannot be accepted until both options use the same workload assumptions, recovery targets, tax/currency basis and owner labor assumptions.

## 4. Billing controls

- [ ] App owner controls the payment method and invoices.
- [ ] Recovery email belongs to the owner/company, not solely a developer.
- [ ] Monthly budget and usage alerts are enabled for every usage-priced service.
- [ ] Escalation thresholds are documented for 50%, 80%, 100% and unexpected spend.
- [ ] Auto-scaling and AI/image usage have explicit caps where supported.
- [ ] Renewal dates for domains, app stores and annual plans are calendared.
- [ ] Free-tier limits and expiry dates are recorded.
- [ ] Actual invoices are reconciled monthly against this register.
- [ ] The responsible billing owner signs the launch cost estimate.

## 5. Monthly review record

| Month | Forecast | Actual | Variance/cause | Usage anomalies | Owner action | Reviewer/date |
|---|---:|---:|---|---|---|---|
| Not started | TBD | n/a | n/a | n/a | Complete during Phase 8 | TBD |

Production launch is blocked until the selected architecture has verified current, 1,000-user and 10,000-user scenarios and owner-controlled billing alerts.
