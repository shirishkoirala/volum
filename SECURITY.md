# Security Policy

## Supported Versions

Security fixes are applied to the latest released version and the current
`master` branch. Older images and source releases may not receive patches.

## Report a Vulnerability

Do not open a public issue for a suspected vulnerability.

Use GitHub's private
[security advisory form](https://github.com/shirishkoirala/volum/security/advisories/new)
and include:

- Affected version or commit
- Deployment configuration relevant to the issue
- Reproduction steps or proof of concept
- Expected impact
- Any known workaround

Remove real credentials, session cookies, bootstrap tokens, personal file
paths, and private file contents. Use a disposable environment for
reproduction.

The maintainer will acknowledge a report when it is reviewed, validate the
impact, and coordinate a fix and disclosure. Response and release timing depend
on severity and maintainer availability; no fixed service-level agreement is
promised.

## Security Boundaries

Volum is designed for trusted private infrastructure and can be configured to
access host files. Reports are especially useful when they involve:

- Authentication or role bypass
- Path traversal or access outside configured roots
- Unauthorized file modification or download
- Share-link authentication or limit bypass
- Host, origin, proxy, or cookie validation bypass
- Server-side request forgery through service health checks
- Unsafe archive extraction
- Secrets exposed in logs, API responses, or generated files

Configuration that explicitly disables authentication or mounts the entire
host filesystem is inherently high risk. A report should distinguish insecure
deployment choices from a bypass of documented safeguards.

## Dependency Reports

Automated scanner output is useful when it includes a reachable code path and
impact analysis. Reports based only on a package version, without showing that
Volum is affected, may be closed after review.
