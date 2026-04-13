# Dynexis LaunchOps — Security Architecture Design

**Author:** Sentinel Architect (Claude, Principal Systems Engineer mode)
**Date:** 2026-04-13
**Baseline commit:** `ff34b72` (v0.3.0-hardening)
**Classification:** Internal / Engineering — Not for external distribution

---

## 1. Executive Summary

LaunchOps is an agentic platform that executes financial, legal, and infrastructure operations on behalf of founders. It touches Stripe payment APIs, generates legally binding documents, runs shell commands on servers, and manages credential vaults. **This is a fintech-grade threat surface** — a single compromise can result in financial loss, legal liability, or data breach.

Sprint 1 hardening closed the most catastrophic vectors (RCE via `shell=True`, unauthenticated API access, fail-open governance bypass). However, the system still has **5 CRITICAL and 3 HIGH severity findings** that must be resolved before any deployment that processes real money or PII.

This document provides the target security architecture and the specific technical mitigations for each finding, designed to satisfy PCI-DSS v4.0 requirements 6.2 (secure development), 8.3 (authentication), and 10.2 (audit trails), as well as SOC2 Type II CC6 (logical access) and CC8 (change management).

---

## 2. Logic Diagram — Data Flow (Target Architecture)

```
                         TLS 1.3 (mandatory)
   Operator/Dashboard ──────────────────────> Nginx Reverse Proxy
                                               │
                                               │ TLS termination
                                               │ Rate limiter (leaky bucket)
                                               │ Request-ID injection
                                               ▼
                                          FastAPI Gateway
                                               │
                              ┌────────────────┼────────────────┐
                              │                │                │
                              ▼                ▼                ▼
                       Auth Middleware    CORS Middleware   Logging Middleware
                       (HMAC-SHA256      (origin allow     (structured JSON
                        salted keys,      list from env,    with request_id,
                        rate-limited)     no wildcards)     tenant_id, stage)
                              │
                              ▼
                     ┌─────────────────┐
                     │  Route Handlers  │
                     │  /atlas/v2/*     │
                     │  /api/v1/*       │
                     │  /mcp/*          │
                     └────────┬────────┘
                              │
                 ┌────────────┼────────────┐
                 ▼            ▼            ▼
          Phase2Executor   MCPGateway   OnboardingAPI
                 │            │            │
                 ▼            │            │
          ProofGuard          │            │
          (mTLS to control    │            │
           plane, attestation │            │
           signed with HMAC)  │            │
                 │            │            │
                 ▼            ▼            ▼
          ┌──────────────────────────────────┐
          │  Agent Execution Layer            │
          │  (sandboxed subprocess,           │
          │   shell=False default,            │
          │   per-agent resource limits)      │
          └──────────────┬───────────────────┘
                         │
            ┌────────────┼────────────────┐
            ▼            ▼                ▼
     SharedContext    StateStore     CredentialVault
     (per-tenant      (SQLite WAL,    (AES-256 via
      namespace,       parameterized   Fernet, key
      JSON on disk)    queries only)   from KMS/HSM)
```

---

## 3. Threat Model

### 3.1 Attack Surface Enumeration

| Surface | Entry Point | Data at Risk | Current Mitigation | Gap |
|---------|------------|--------------|-------------------|-----|
| API Gateway | HTTP POST to any /atlas/* route | Pipeline execution, Stripe calls, file writes | API key auth (SHA-256 hashed, timing-safe) | Unsalted hash, no rate limit |
| HITL Endpoints | POST /atlas/v2/hitl/{id}/approve | Governance bypass | Auth required | No per-attestation authorization |
| MCP Gateway | POST /mcp/invoke | Agent execution, external calls | Bearer token on /mcp only | Token is simple string equality |
| ProofGuard Comms | HTTP to localhost:3000 | Attestation verdicts | Bearer token | HTTP not HTTPS, no mTLS |
| Credential Vault | Disk read at ~/.launchops/data/vault.key | All stored secrets | Fernet (AES-128-CBC) | No rotation, file-based key |
| Subprocess | BaseAgent.run_command() | Server RCE | shell=False default | shell=True opt-in still exists |
| SharedContext | JSON files on disk | Business PII, deal data | Per-run file isolation | No per-tenant namespace |
| Docker Runtime | Container processes | Full system access | Health checks | Root user, no seccomp |
| Dependencies | PyPI packages at install | Supply chain compromise | requirements.txt | No pinning, no audit |

### 3.2 STRIDE Classification

| Threat | Category | Risk | Specific Vector |
|--------|----------|------|-----------------|
| T1 | **S**poofing | CRITICAL | Unsalted API key hashes allow rainbow table attacks if DB is leaked |
| T2 | **T**ampering | CRITICAL | Any auth'd user can approve HITL decisions for any attestation |
| T3 | **R**epudiation | HIGH | No signed audit trail; attestation records can be modified in SQLite |
| T4 | **I**nformation Disclosure | HIGH | SharedContext files readable by any process on the host |
| T5 | **D**enial of Service | HIGH | No rate limiting; unbounded LLM calls; thread pool exhaustion |
| T6 | **E**levation of Privilege | CRITICAL | Docker runs as root; container escape = host compromise |

### 3.3 Cryptographic Strength Analysis

Current API key hash:

$$H(k) = \text{SHA-256}(k)$$

Without a salt, an attacker with access to the hashed keys can precompute a rainbow table. For a key space of `urlsafe_b64(32)` (43 characters, 256 bits of entropy), the precomputation cost is:

$$\text{Cost} = 2^{256} \text{ (infeasible)}$$

However, if the operator sets a weak key (e.g., "password123"), the effective entropy drops to ~30 bits:

$$P(\text{crack in } T \text{ seconds}) = \frac{T \cdot R}{2^{30}} \approx 1 \text{ at } T = 1000s, R = 10^6 \text{ H/s}$$

**Mitigation:** Salt with a per-key random nonce + use PBKDF2/scrypt/argon2 instead of raw SHA-256.

---

## 4. Failure Mode Analysis

### 4.1 ProofGuard control plane goes down

**Current behavior (post-Sprint 1):** `_fail_result()` returns `BLOCKED`. All pipeline execution halts.
**Assessment:** Correct fail-closed behavior. No data loss, no unauthorized execution.
**Recovery:** Restart ProofGuard. Pipeline can be re-triggered.
**RTO:** Minutes (restart container). **RPO:** Zero (attestations persist in Drizzle DB).

### 4.2 Fernet vault key leaked

**Current behavior:** All stored credentials (Stripe keys, DB passwords, SMTP creds) are decryptable.
**Blast radius:** Total compromise of all integrated services.
**Mitigation plan:**
1. Rotate ALL credentials stored in the vault
2. Generate a new Fernet key
3. Re-encrypt the vault with the new key
4. Revoke the leaked key at the source (if backed by KMS, revoke the CMK)

**Current gap:** No rotation tooling exists. Manual process.

### 4.3 SQLite database corrupted

**Current behavior:** StateStore creates a new connection; if the DB file is corrupted, the connection fails and the API returns 500 errors.
**Mitigation:** WAL mode reduces corruption risk. Add a startup integrity check (`PRAGMA integrity_check`).

### 4.4 API key brute-forced

**Current behavior:** No rate limiting. An attacker can try unlimited keys per second.
**Mitigation required:** Token-bucket rate limiter (10 attempts/minute per IP), exponential backoff, and IP blocklist after 50 failures.

---

## 5. Compliance Mapping

| Requirement | Standard | Current State | Gap |
|-------------|----------|--------------|-----|
| Unique user identification | PCI-DSS 8.2.1 | API keys per operator | No per-user identity; keys are shared |
| MFA for admin access | PCI-DSS 8.4.2 | None | No MFA on any path |
| Encrypt data at rest | PCI-DSS 3.5.1 | Fernet vault (AES-128-CBC) | Key not in HSM/KMS |
| Encrypt data in transit | PCI-DSS 4.2.1 | TLS available but not enforced | Nginx config lacks TLS enforcement |
| Audit trail for access | PCI-DSS 10.2.1 | Structured JSON logging | No immutable log store |
| Secure development | PCI-DSS 6.2.4 | Sprint 1 fixes (shell, auth, CORS) | No SAST/DAST in CI |
| Access control | SOC2 CC6.1 | API key auth | No RBAC, no per-resource authorization |
| Change management | SOC2 CC8.1 | Git commits with co-author | No signed commits, no review gates |
| Availability monitoring | SOC2 A1.2 | Docker HEALTHCHECK | No external uptime monitoring |

---

## 6. Remediation Plan (Ordered by Severity)

### Phase A — Deploy-blocking (before any real-money deployment)

| # | Finding | Fix | Effort |
|---|---------|-----|--------|
| A1 | Docker runs as root | Add `RUN adduser --system appuser` + `USER appuser` to Dockerfile | 5 min |
| A2 | Unsalted API key hash | Switch to `hashlib.pbkdf2_hmac("sha256", key, salt, 100000)` with per-key random salt stored alongside the hash | 30 min |
| A3 | No HITL per-attestation authz | Add `attestation_owner` field to hitl_decisions; verify caller API key matches the deployment that created the attestation | 45 min |
| A4 | TLS not enforced in nginx | Add SSL cert paths + HTTP-to-HTTPS redirect + HSTS header to production nginx config | 20 min |
| A5 | No rate limiting on auth | Add token-bucket rate limiter (in-memory for v1, Redis for v2) on all auth-checking endpoints | 45 min |
| A6 | Pin dependency versions | Run `pip freeze > requirements.lock` and reference it in Dockerfile | 10 min |

### Phase B — Pre-commercial (before charging customers)

| # | Finding | Fix | Effort |
|---|---------|-----|--------|
| B1 | Fernet key rotation | Add `vault rotate` CLI command + re-encryption flow | 2 hours |
| B2 | Per-tenant context isolation | Namespace SharedContext to `~/.launchops/tenants/{tenant_id}/` | 3 hours |
| B3 | Signed audit trail | HMAC-sign each audit log entry with a per-deployment key | 2 hours |
| B4 | SAST in CI | Add `bandit` + `semgrep` to a GitHub Actions workflow | 1 hour |
| B5 | pip-audit in CI | Add `pip-audit` step to the workflow | 15 min |

### Phase C — Enterprise-ready

| # | Finding | Fix | Effort |
|---|---------|-----|--------|
| C1 | KMS-backed vault key | Integrate with AWS KMS or HashiCorp Vault for key wrapping | 1 day |
| C2 | mTLS for ProofGuard | Generate client certs; enforce mutual TLS on /api/attest | 4 hours |
| C3 | RBAC with scoped tokens | Replace flat API keys with JWT + role claims | 1 day |
| C4 | Immutable audit log | Write to append-only S3 + Athena, or a blockchain-backed log | 2 days |

---

## 7. Immediate Sprint 2 Security Items

Based on this design, the following items are added to Sprint 2 and will be implemented now:

1. **A1 — Non-root Docker** (5 min)
2. **A2 — Salted API key hashing** (30 min)
3. **A5 — Auth rate limiting** (45 min)
4. **A6 — Pinned dependencies** (10 min)
5. **A4 — Nginx TLS enforcement** (20 min)
6. **A3 — HITL per-attestation authorization** (45 min)

These six items close every CRITICAL and HIGH finding from the security survey.
