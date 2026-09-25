---
name: spectrascope-review
description: Review SpectraScope code changes for target authorization, network-scope safety, scanner side effects, API compatibility, and proportionate tests. Use for pull-request or pre-merge review in this repository.
---

# SpectraScope review

Review the requested diff or changed files. Do not edit code unless the user separately asks for fixes.

## Establish scope

1. Read `AGENTS.md`, `SECURITY.md`, and the changed files.
2. Inspect the diff and the nearest tests. Ignore unrelated working-tree changes.
3. Identify whether the change touches API contracts, target/profile policy, network access, scanner processes, authentication, secrets, persistence, or the vulnerable lab.

## Check invariants

- A scan requires explicit authorization confirmation.
- Real scanners remain disabled by default and constrained by configured allowlists.
- Target normalization, target policy, profile validation, and external-network validation are not bypassed.
- Preview/dry-run paths perform no DNS, HTTP, subprocess, Celery, scanner, or other external I/O.
- Secrets, real target names, raw evidence, and database dumps are neither logged nor committed.
- Failures do not silently broaden scan scope or fail open.
- API, database, and frontend contracts remain compatible or are deliberately migrated together.

## Verify

Run the smallest relevant checks first. For backend changes, use the closest `tests/test_*.py` module and then the full suite when practical. For frontend changes, run lint and build. For scanner changes, require positive and negative authorization/scope tests.

Do not run real scanners against public or unlisted targets as part of review. Use preview mode, mocks, or the bundled local lab.

## Report

List findings first, ordered by severity. For each finding include the file and line, the concrete failure mode, and a focused remedy. Distinguish verified defects from risks or questions. Then note remaining test gaps and provide a short verdict. If there are no findings, say so explicitly and still describe residual risks and checks performed.
