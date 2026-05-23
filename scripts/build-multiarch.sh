#!/usr/bin/env bash
set -euo pipefail

# Build Volum for multiple architectures without pushing.
# Requires: docker buildx (built-in to Docker Desktop / Docker Engine 23+)
#
# Usage: ./scripts/build-multiarch.sh [tag]
#   tag defaults to "dev"

TAG="${1:-dev}"
IMAGE="volum-volum:${TAG}"

echo "==> Building ${IMAGE} for linux/amd64, linux/arm64"

docker buildx build \
  --platform linux/amd64,linux/arm64 \
  --load=false \
  --tag "${IMAGE}" \
  --file Dockerfile \
  .

echo "==> Done. Use --load to make images available locally, or --push to publish."
echo "    Example: docker buildx build --platform linux/amd64,linux/arm64 --push --tag ghcr.io/your-org/volum:${TAG} ."
