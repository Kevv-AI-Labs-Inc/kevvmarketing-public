# Agent Skills

This repository intentionally does not vendor Kevv internal Codex/agent skills.

Those skills are developer tooling, not product runtime dependencies. Keeping them out of the public repository avoids publishing internal prompts, workflows, and tooling metadata that are not needed to build or deploy the product.

## Internal Setup

Kevv developers should keep private skills in a separate private workspace or private repository, then expose them to Codex through `~/.codex/skills`.

Recommended private skill names:

- `kevv-api-design`
- `kevv-content-engine`
- `kevv-postgres-patterns`
- `kevv-ui-ux-pro-max`

Recommended pattern:

1. Clone or copy the private skill pack outside this repository.
2. Symlink each skill into `~/.codex/skills`.
3. Restart Codex after installing or updating skills.

## Public Contributors

Public contributors do not need Kevv private skills to build, test, or self-host this project.

If you want extra Codex capabilities, install public/global skills separately under `~/.codex/skills` without committing them into this repository.
