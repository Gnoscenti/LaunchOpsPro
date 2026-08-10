# Contributing to LaunchOpsPro

## Verify before proposing a change

```bash
python -m pip install -e "./backend[dev]"
python -m compileall -q agents api core backend/app
pytest -q backend/tests/test_mock_deployment.py

cd dashboard
npm ci
npm run build

cd ../platform
corepack enable
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm build
```

Docker configuration can be validated with non-production values:

```bash
DB_PASSWORD=test DB_ROOT_PASSWORD=test \
DATABASE_URL=mysql://launchops:test@mysql:3306/launchops \
JWT_SECRET=local_test_secret_at_least_32_bytes OWNER_OPEN_ID=local \
docker compose config --quiet
```

The root `tests/test_agents.py` suite is quarantined because its contracts no longer match the current agents. Run it when repairing that debt, but do not report it as passing; see [`docs/TEST_DEBT.md`](docs/TEST_DEBT.md).

## Pull-request standard

- Keep one concern per pull request.
- State root cause, user impact, security impact, verification, limitations, and rollback.
- Add tests for behavior changes and update architecture documents for contract changes.
- Never commit `.env`, generated credentials, customer data, or live service exports.
- Do not add another product variant when a module, feature flag, or offer tier is sufficient.
- Treat authentication, command execution, agent side effects, billing, persistence, and deployment as high-risk boundaries.
