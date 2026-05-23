# Release Process

## Versioning

Volum follows [SemVer](https://semver.org/) (vMAJOR.MINOR.PATCH). Pre-release tags use `-alpha.N`, `-beta.N`.

## Release Steps

### 1. Prepare

```sh
git checkout master && git pull
```

- Check `backend/internal/version/version.go` — the `Version` var is set at build time via ldflags, not hardcoded.
- Verify `CHANGELOG.md` is up to date with entries since last release.
- Update `docs/roadmap.md` if phase items were completed.
- Update `README.md` screenshots if UI changed.

### 2. Tag and push

```sh
VERSION=v0.1.0
git tag -a "${VERSION}" -m "Volum ${VERSION}"
git push origin "${VERSION}"
```

Pushing a tag triggers the GitHub Actions workflow in `.github/workflows/docker.yml`:
- Builds `linux/amd64` and `linux/arm64` images
- Pushes to `ghcr.io/<owner>/volum:<version>`, `ghcr.io/<owner>/volum:<major>.<minor>`, `ghcr.io/<owner>/volum:sha-<hash>`
- On `master` branch pushes (not just tags), images tagged with `master` and `sha-<hash>` are pushed.

### 3. Verify

```sh
docker run --rm ghcr.io/<owner>/volum:<version> --version
```

- Pull image on an arm64 device (Raspberry Pi, Mac) to confirm multi-arch works.
- Deploy `docker-compose.server.yml` from scratch and confirm:
  - Web UI loads at configured port
  - Root browsing works
  - Can create a folder, upload a file, trash a file
  - Jobs run and complete
  - Settings page shows correct version

### 4. Publish release

- Go to GitHub repo → Releases → "Create a new release"
- Select the tag
- Title: `Volum v0.1.0`
- Body: copy relevant entries from `CHANGELOG.md`
- Attach any binaries if applicable (currently Docker-only)

### 5. Post-release

- Post on [/r/selfhosted](https://reddit.com/r/selfhosted) if this is a notable release
- Update the demo instance if applicable
- Announce on relevant self-hosted discords/communities

## Smoke Test (manual)

```sh
# Start from clean state
cd /tmp && mkdir -p test-volum storage data
cd test-volum
cat > docker-compose.yml <<EOF
services:
  volum:
    image: ghcr.io/<owner>/volum:latest
    ports:
      - "8091:8090"
    volumes:
      - ./storage:/storage
      - ./data:/data
    environment:
      - VOLUM_AUTH_REQUIRED=false
      - VOLUM_ROOTS=/storage
      - VOLUM_DB=/data/volum.db
EOF

docker compose up -d
sleep 2

# Health check
curl -s http://localhost:8091/api/status | jq .version

# Browse
curl -s http://localhost:8091/api/files?path=/storage | jq '.files | length'

# Clean up
docker compose down -v
rm -rf test-volum storage data
```

## Changelog Format

```
## [v0.1.0] - 2026-05-23

### Added
- Feature description (#pr)

### Fixed
- Bug description (#pr)

### Changed
- Breaking change description (#pr)
```
