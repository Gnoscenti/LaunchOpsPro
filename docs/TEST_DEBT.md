# Test-debt register

## Baseline

On the first CI execution of the repository root suite:

```text
pytest -q tests/test_agents.py
32 failed, 16 passed
```

The failures are deterministic contract drift, not flaky infrastructure. Examples include:

- `AtlasConfig` no longer exists under the expected name;
- configuration assertions expect removed `business`, `llm`, and `ports` groupings;
- `CredentialVault` tests call removed `set`, `get`, and `generate_password` methods;
- agent tests instantiate classes without their now-required `role`, `llm_client`, or `config` arguments;
- tests expect response keys and private helpers that current agents no longer expose;
- several agents call a removed `log_info` helper.

## Quarantine policy

The suite remains visible in CI as `legacy-agent-contracts` with job-level `continue-on-error`. This is a temporary, explicit quarantine—not evidence that the behavior passes.

The blocking Python path covers package compilation and the maintained backend mock-deployment test. The legacy suite returns to blocking status when:

1. each test is assigned to the current root engine, backend engine, or deleted product path;
2. public contracts are documented before assertions are rewritten;
3. obsolete tests are removed with a linked rationale;
4. current behavior receives equivalent or stronger coverage;
5. the full suite passes twice from a clean checkout.

## Repair order

1. Configuration and credential-vault contracts.
2. Base-agent constructor and logging contract.
3. Paralegal, WordPress, Security, Stripe, Analytics, Growth, and Email agent fixtures.
4. Response-schema assertions.
5. Side-effect isolation and governance-path integration tests.
