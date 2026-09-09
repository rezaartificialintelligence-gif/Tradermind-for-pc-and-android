---
name: GitHub Actions builds
description: Constraints that keep TraderMind's web, Android, and Windows GitHub builds reproducible.
---

Pin the pnpm version used by GitHub Actions to the version that generated the committed lockfile; older pnpm versions can reject the lockfile's workspace overrides during frozen installs.

**Why:** A successful local install is not enough when CI uses a different pnpm release, and the failure happens before typecheck or build jobs run.

**How to apply:** Keep the CI pnpm version aligned with the lockfile and ensure the Electron package always contains tracked main/preload runtime sources before invoking electron-builder.