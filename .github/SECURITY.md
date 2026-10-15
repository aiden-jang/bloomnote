# Security reporting

Report vulnerabilities using [GitHub’s private reporting form](https://github.com/aiden-jang/bloomnote/security/advisories/new).
Include reproduction steps and the affected behavior. Use synthetic notes and test links; omit
credentials, real messages, and anyone else’s garden IDs from reports and attachments.

Shared garden links intentionally allow anyone holding the link to read the garden. Account
libraries and mutations require a session. Scheduled reveals are a UI feature, not encryption.
Unexpected access across those boundaries, bypassed atomic limits, secret exposure, and mutable
link-preview images are security issues.

Security fixes target the current default branch. Dependencies, code, and secrets are scanned
through GitHub; the complete dependency audit also runs in verification and CI.
