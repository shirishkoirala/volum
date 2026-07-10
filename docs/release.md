# Release Checklist

Volum releases are published from semantic version tags such as `v0.1.0`.

## Cost

For a public GitHub repository, the normal release path should not require paid
services:

- Standard GitHub-hosted Actions runners are free for public repositories.
- GitHub Packages usage is free for public packages.
- GitHub Container Registry image storage and bandwidth are currently free.

Private repositories use plan quotas for Actions, artifacts, and package
storage. If quotas are exceeded, GitHub may block usage without a payment method
or bill the repository owner when billing is enabled.

## Before Tagging

1. Confirm `master` CI is green.
2. Run the production Docker verification:

   ```sh
   docker build --target backend-base .
   ```

3. Run the reverse-proxy upload smoke:

   ```sh
   make smoke-proxy
   ```

4. Update `CHANGELOG.md` with changes since the last release. Contributors are
   encouraged to label their pull requests with `changelog/fix`, `changelog/feat`,
   `changelog/breaking`, or `changelog/infra` to help identify which changes
   belong in the changelog and under which section. The maintainer curates the
   changelog during release preparation; contributors do not edit it.
5. Confirm `README.md` deployment instructions match the published image.

## Publish

Create and push a release tag:

```sh
git tag v0.1.0
git push origin v0.1.0
```

The release workflow publishes:

- `ghcr.io/shirishkoirala/volum:0.1.0`
- `ghcr.io/shirishkoirala/volum:0.1`
- `ghcr.io/shirishkoirala/volum:latest`

It also creates a GitHub release using `CHANGELOG.md` as the release notes.

## After Publishing

1. Confirm the Docker image package is public in GHCR.
2. Pull and inspect the image:

   ```sh
   docker pull ghcr.io/shirishkoirala/volum:0.1.0
   docker inspect ghcr.io/shirishkoirala/volum:0.1.0
   ```

3. Run a clean container from the published image.
4. Confirm `/api/version` reports the release version.
