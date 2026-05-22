package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/volum-app/volum/backend/internal/api"
	"github.com/volum-app/volum/backend/internal/auth"
	"github.com/volum-app/volum/backend/internal/config"
	"github.com/volum-app/volum/backend/internal/files"
	"github.com/volum-app/volum/backend/internal/jobs"
	"github.com/volum-app/volum/backend/internal/security"
	"github.com/volum-app/volum/backend/internal/storage"
	"github.com/volum-app/volum/backend/internal/worker"
)

func main() {
	log := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	if err := run(log); err != nil {
		log.Error("server stopped", "error", err)
		os.Exit(1)
	}
}

func run(log *slog.Logger) error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}

	guard, err := security.NewRootGuardWithRoots(cfg.Roots)
	if err != nil {
		return err
	}

	db, err := storage.Open(cfg.DB)
	if err != nil {
		return err
	}
	defer db.Close()

	jobStore := jobs.NewStore(db)
	backgroundWorker := worker.New(jobStore, guard, log)
	authService, err := auth.New(cfg.AdminPassword, cfg.ReadonlyPassword, cfg.SessionSecret)
	if err != nil {
		return err
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	if err := backgroundWorker.Recover(ctx); err != nil {
		return err
	}
	go backgroundWorker.Start(ctx)

	filesService := files.NewService(guard)
	server := api.New(filesService, jobStore, guard, authService)

	httpServer := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           server.Handler(),
		ReadHeaderTimeout: 10 * time.Second,
	}

	errCh := make(chan error, 1)
	go func() {
		log.Info("http server listening", "port", cfg.Port)
		errCh <- httpServer.ListenAndServe()
	}()

	select {
	case <-ctx.Done():
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		return httpServer.Shutdown(shutdownCtx)
	case err := <-errCh:
		if errors.Is(err, http.ErrServerClosed) {
			return nil
		}
		return err
	}
}
