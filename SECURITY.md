# Security policy

## Project status

LaunchOpsPro is an active commercial-alpha prototype. The default branch is the supported development line; this repository does not currently promise a production SLA.

## Private reporting

Do not publish vulnerabilities, credentials, private customer data, or exploitable configurations in an issue. Use GitHub private vulnerability reporting when available or establish a private channel with the repository owner through their GitHub profile.

Include the affected commit, component, required access, minimal reproduction, impact, and suggested mitigation. Redact all real secrets and personal data.

## Security invariants

- Production authentication bypass flags remain false.
- Database, JWT, API, provider, billing, and vault secrets are supplied at runtime and have no usable defaults.
- Consequential agent actions pass through configured authorization and governance checks.
- Command execution uses argument arrays and `shell=False` unless a reviewed, constrained use case requires a shell.
- Browser origins are explicit and environment-driven.
- Deployment is provider-neutral; retired infrastructure workflows must not remain active.
- Logs, artifacts, and generated documents are treated as potentially sensitive.

Known gaps and release gates are recorded in [`docs/RELEASE_READINESS.md`](docs/RELEASE_READINESS.md).
