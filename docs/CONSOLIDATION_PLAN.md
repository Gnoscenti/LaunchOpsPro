# LaunchOps consolidation plan

LaunchOpsPro is the canonical founder-operations product. Founder Edition is an offer/package, not an independent product architecture.

## Source repositories

| Source | Intended disposition | Preserve before archival |
|---|---|---|
| `Gnoscenti/microai-launchops` | Merge unique infrastructure/backend work | APIs, deployment adapters, migrations, operational runbooks |
| `MicroAIStudios-DAO/launchops-founder-edition` | Convert to packaging/offer history | Founder-specific onboarding, pricing, templates, sales assets |
| `Gnoscenti/founder-autopilot` | Archive after verification | Unique workflows and attribution; README already marks it superseded |
| `Gnoscenti/atlas-launchops` | Archive after verification | Unique commits, docs, or deployment contracts |
| `Gnoscenti/launchops-stack` | Archive after verification | Infrastructure definitions not represented here |

## Import rules

- Import behavior through focused pull requests, not directory dumps.
- Preserve authorship and source commit links in the pull-request description.
- Prefer modules, adapters, feature flags, and configuration over copied applications.
- Reject code that reintroduces retired Vultr dependencies, hard-coded credentials, auth bypass, or a second orchestration path without an accepted architecture decision.
- Add compatibility or regression tests for every imported contract.

## Archive gate

No source repository is archived until its branches and unique commits are inventoried, preserved work is merged and verified, its README points here, secret history is privately reviewed, and the owner explicitly approves the archive action.
