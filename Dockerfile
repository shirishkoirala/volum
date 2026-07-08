FROM golang:1.23-alpine AS backend-base
WORKDIR /app/backend
RUN apk add --no-cache gcc musl-dev
COPY backend/go.mod backend/go.sum ./
RUN go mod download
RUN go install github.com/golangci/golangci-lint/v2/cmd/golangci-lint@v2.12.2
COPY backend ./
RUN golangci-lint run ./...
RUN go vet ./...
RUN go test ./...

FROM node:22-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend ./
RUN npm run format:check
RUN npm run test
RUN npm run build

FROM backend-base AS backend
COPY --from=frontend /app/frontend/dist ./web
RUN go build \
	-ldflags="-X github.com/volum-app/volum/backend/internal/version.Version=$(git describe --tags --always 2>/dev/null || echo dev) -X github.com/volum-app/volum/backend/internal/version.BuildTime=$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
	-o /out/volum ./cmd/volum

FROM alpine:3.20
RUN apk add --no-cache ca-certificates util-linux
WORKDIR /app
COPY --from=backend /out/volum /app/volum
COPY --from=backend /app/backend/web /app/web
EXPOSE 8090
CMD ["/app/volum"]
