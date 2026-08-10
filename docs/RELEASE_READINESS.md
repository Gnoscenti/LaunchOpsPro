# Release readiness

Status: commercial-alpha hardening plan. A green CI run proves only the checks named here; it is not a production certification.

## Verified baseline introduced by this change

| Gate | Evidence | Result after merge |
|---|---|---|
| Python agent regression tests | `pytest -q tests/test_agents.py` in CI | Automatically checked |
| Dashboard compilation and bundle | `npm ci && npm run build` in CI | Automatically checked |
| Platform typecheck, tests, and build | pnpm jobs in CI | Automatically checked |
| Container configuration | `docker compose config --quiet` with required secrets | Automatically checked |
| Secure container defaults | Required database/JWT/owner values; auth bypass false; MySQL not host-published | Configuration hardened |
| Provider-neutral automation | Retired Vultr workflow removed | No automatic production deployment |
| License and reporting path | Root `LICENSE` and `SECURITY.md` | Explicit |

## Blocking gates for production customers

- [ ] All externally reachable write routes require authenticated, authorized principals.
- [ ] CORS allow-list is environment-driven and covered by a negative test.
- [ ] Command execution defaults to `shell=False`; every shell exception is constrained and tested.
- [ ] ProofGuard integration fails closed for consequential actions.
- [ ] Tenant identity is present in persistent state, logs, artifacts, and usage records.
- [ ] Deployment and run state survive process restarts.
- [ ] Billing webhooks are verified and idempotent; entitlements are enforced server-side.
- [ ] Secrets are managed outside Compose and rotated through a documented runbook.
- [ ] Backups and restore drills cover databases, artifacts, and configuration.
- [ ] Structured logs include correlation, run, tenant, deployment, and agent identifiers without sensitive payloads.
- [ ] Rate limits, cost budgets, timeouts, retries, and circuit breakers are defined.
- [ ] Threat model and independent security review cover the production deployment path.

## Release evidence packet

Every release candidate should attach:

1. exact commit SHA and dependency lockfiles;
2. CI run links and test counts;
3. database/configuration migration notes;
4. threat-model changes;
5. known limitations and accepted risks;
6. deployment, smoke-test, rollback, and restore commands;
7. signed-off owner for security, product, and operations.

## Demo claim policy

Label each demonstration artifact as live, recorded, synthetic, mocked, or illustrative. Do not use “production ready,” “autonomous,” “compliant,” or an SLA percentage unless the repository and operating evidence support the exact claim.
