# Architecture Decision Records

These records document constraints that are easy to accidentally reverse:

- [ADR 0001: RootGuard is the filesystem boundary](0001-rootguard-filesystem-boundary.md)
- [ADR 0002: Cross-mount moves use copy, verify, delete](0002-cross-mount-moves.md)
- [ADR 0003: SQLite uses one open connection](0003-single-sqlite-connection.md)
- [ADR 0004: Browser mutations require request validation](0004-browser-mutation-protection.md)
- [ADR 0005: Desktop assets and action icons have separate roles](0005-icon-roles.md)

Add an ADR when a decision constrains future implementations, especially for
data safety, security, persistence, or a cross-cutting frontend convention.
