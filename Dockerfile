FROM golang:1.26-alpine AS backend-toolchain
WORKDIR /app/backend
RUN apk add --no-cache binutils gcc musl-dev
COPY backend/go.mod backend/go.sum ./
RUN go mod download
RUN CGO_ENABLED=0 go install github.com/golangci/golangci-lint/v2/cmd/golangci-lint@v2.3.1
COPY backend ./

FROM backend-toolchain AS backend-base
ARG RUN_BACKEND_CHECKS=true
RUN if [ "${RUN_BACKEND_CHECKS}" = "true" ]; then golangci-lint run --timeout=20m ./...; fi
RUN if [ "${RUN_BACKEND_CHECKS}" = "true" ]; then go vet ./...; fi
RUN if [ "${RUN_BACKEND_CHECKS}" = "true" ]; then go test ./...; fi

FROM node:26-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend ./
ARG RUN_FRONTEND_CHECKS=true
RUN if [ "${RUN_FRONTEND_CHECKS}" = "true" ]; then npm run format:check; fi
RUN if [ "${RUN_FRONTEND_CHECKS}" = "true" ]; then npm run test:ci; fi
ARG VITE_PUBLIC_PATH=""
RUN VITE_PUBLIC_PATH=${VITE_PUBLIC_PATH} npm run build

FROM backend-base AS backend
COPY --from=frontend /app/frontend/dist ./web
ARG VERSION=dev
ARG BUILD_TIME=""
RUN go build \
	-ldflags="-X github.com/volum-app/volum/backend/internal/version.Version=${VERSION} -X github.com/volum-app/volum/backend/internal/version.BuildTime=${BUILD_TIME}" \
	-o /out/volum ./cmd/volum

FROM alpine:3.24
RUN apk add --no-cache ca-certificates util-linux
WORKDIR /app
COPY --from=backend /out/volum /app/volum
COPY --from=backend /app/backend/web /app/web
EXPOSE 8090
CMD ["/app/volum"]
