# Quality checks

Run `pnpm run verify` before committing. [Contributing](../CONTRIBUTING.md)
describes the repository gates and local setup. Browser journeys use disposable
local data; they must not create production records.

For interface changes, compare desktop and phone views with the [design guide](../DESIGN.md).
Inspect keyboard focus, reduced motion, long content and empty/loading/error states.
Automated accessibility scans and browser emulation do not establish physical-device
behavior, native sharing or spoken screen-reader output. State unavailable checks.

Curated README images live in `docs/screenshots/`. They use synthetic data and describe
the illustrated revision; they do not verify every subsequent change.

## Review artifacts

Keep generated screenshot sets, videos, traces and run reports in ignored
`test-results/` output or a temporary local directory. CI artifacts should expire.
Commit authored design references and a small curated set of README images only;
keep runtime and installation assets separate. Earlier audit records remain in Git
history. Use synthetic data and remove private information from shared evidence.
