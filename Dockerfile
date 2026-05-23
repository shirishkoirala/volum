FROM node:22-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend ./
RUN npm run build

FROM golang:1.23-alpine AS backend
WORKDIR /app/backend
RUN apk add --no-cache gcc musl-dev
COPY backend/go.mod ./
RUN go mod download
COPY backend ./
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
