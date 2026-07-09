# Support

## Choose the Right Channel

### Usage and deployment questions

Read these first:

- [README](README.md) for installation and first run
- [Reverse proxy guide](docs/reverse-proxy.md) for host, origin, TLS, and
  subpath configuration
- [Release guide](docs/release.md) for published images and releases
- [Contributor guide](CONTRIBUTING.md) for development setup

If the documentation does not answer the question, open a documentation issue
when the missing information can be improved for everyone.

### Reproducible bugs

Use the GitHub bug report form. Include:

- Volum version or commit
- Deployment mode
- Host operating system and architecture
- Browser version for interface problems
- Minimal reproduction steps
- Sanitized API, container, or browser logs

Test file-operation bugs with disposable data. Never upload session secrets,
bootstrap tokens, passwords, cookies, private file contents, or identifying
paths.

### Feature requests

Check the [product roadmap](docs/roadmap.md), then use the feature request form.
Describe the user problem and acceptance criteria before implementation ideas.

### Security vulnerabilities

Follow [SECURITY.md](SECURITY.md) and report the issue privately. Do not include
exploit details in a public issue.

## Maintainer Expectations

Volum is maintained without a guaranteed response time. Clear reproductions
and focused requests are easier to investigate. A lack of immediate response
does not mean a report has been rejected.

The project cannot provide individualized administration of a contributor's
server, reverse proxy, DNS, Docker host, storage permissions, or network.
Support is focused on Volum behavior and improving reusable documentation.
