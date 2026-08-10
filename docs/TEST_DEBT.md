# Agent contract repair record

## Original baseline

The inherited root suite reported:

```text
32 failed, 16 passed
```

The failures revealed real runtime drift, not only stale assertions:

- subclasses passed the pre-role positional constructor shape, placing dependencies in the wrong fields;
- agents called missing result, logging, LLM, and credential-vault helpers;
- the flat configuration export no longer supplied the grouped business, LLM, and port contracts still consumed by agents;
- the optional external gateway embedded a retired provider endpoint and credential;
- optional-agent import failures were silently discarded by `build_system`.

## Resolution

The runtime now has one documented base-agent contract:

- explicit `name`, `role`, `llm_client`, and normalized `config` fields;
- consistent `success` and `failure` results;
- logging and LLM helper methods;
- encrypted credential access with no plaintext fallback;
- public configuration groups for business, LLM, and service ports;
- runtime-only external gateway configuration;
- surfaced agent-load errors.

The replacement suite tests public offline behavior rather than deleted private
helpers. It is a blocking GitHub Actions job named `agent-contracts`.

## Remaining integration work

Blocking offline tests do not prove that third-party accounts, network routes,
Docker deployments, host-hardening commands, billing writes, or ProofGuard
attestation work in a production environment. Those require explicit credentials,
isolated integration environments, and evidence attached to a release candidate.

