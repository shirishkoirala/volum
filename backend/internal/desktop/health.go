package desktop

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"sync"
	"time"
)

const maxHealthBody int64 = 64 * 1024

type ServiceHealthResult struct {
	ServiceID  string `json:"serviceId"`
	Status     string `json:"status"`
	CheckedAt  string `json:"checkedAt"`
	StatusCode int    `json:"statusCode,omitempty"`
	Error      string `json:"error,omitempty"`
}

type HealthChecker struct {
	store       *Store
	client      *http.Client
	interval    time.Duration
	mu          sync.RWMutex
	cache       map[string]ServiceHealthResult
	subscribers map[int]chan HealthTransition
	nextSubID   int
	log         *slog.Logger
}

type HealthTransition struct {
	ServiceID string               `json:"serviceId"`
	Previous  *ServiceHealthResult `json:"previous,omitempty"`
	Current   ServiceHealthResult  `json:"current"`
}

func NewHealthChecker(store *Store, log *slog.Logger) *HealthChecker {
	return &HealthChecker{
		store: store,
		client: &http.Client{
			Timeout:       3 * time.Second,
			CheckRedirect: redirectBlocked,
			Transport:     safeHealthTransport(),
		},
		interval:    60 * time.Second,
		cache:       make(map[string]ServiceHealthResult),
		subscribers: make(map[int]chan HealthTransition),
		log:         log.With("component", "health-checker"),
	}
}

func (hc *HealthChecker) SubscribeEvents() (<-chan HealthTransition, func()) {
	hc.mu.Lock()
	defer hc.mu.Unlock()

	hc.nextSubID++
	id := hc.nextSubID
	ch := make(chan HealthTransition, 16)
	hc.subscribers[id] = ch

	unsubscribe := func() {
		hc.mu.Lock()
		defer hc.mu.Unlock()
		if existing, ok := hc.subscribers[id]; ok {
			delete(hc.subscribers, id)
			close(existing)
		}
	}
	return ch, unsubscribe
}

func (hc *HealthChecker) Start(ctx context.Context) {
	hc.log.Info("health checker started", "interval", hc.interval)

	// Load cached results from DB on startup
	hc.loadFromDB(ctx)

	// Run immediately on start
	hc.checkAll(ctx)

	ticker := time.NewTicker(hc.interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			hc.log.Info("health checker stopped")
			hc.closeSubscribers()
			return
		case <-ticker.C:
			hc.checkAll(ctx)
		}
	}
}

func (hc *HealthChecker) closeSubscribers() {
	hc.mu.Lock()
	defer hc.mu.Unlock()
	for id, ch := range hc.subscribers {
		delete(hc.subscribers, id)
		close(ch)
	}
}

func (hc *HealthChecker) loadFromDB(ctx context.Context) {
	services, err := hc.store.ListServices(ctx)
	if err != nil {
		hc.log.Error("failed to load services for health cache", "error", err)
		return
	}
	hc.mu.Lock()
	defer hc.mu.Unlock()
	for _, svc := range services {
		if svc.HealthURL == "" {
			continue
		}
		cachedAt := svc.LastHealthCheckedAt
		if cachedAt == "" {
			continue
		}
		hc.cache[svc.ID] = ServiceHealthResult{
			ServiceID:  svc.ID,
			Status:     svc.LastHealthStatus,
			CheckedAt:  cachedAt,
			StatusCode: svc.LastHealthStatusCode,
			Error:      svc.LastHealthError,
		}
	}
}

func (hc *HealthChecker) GetCachedResults() map[string]ServiceHealthResult {
	hc.mu.RLock()
	defer hc.mu.RUnlock()
	results := make(map[string]ServiceHealthResult, len(hc.cache))
	for k, v := range hc.cache {
		results[k] = v
	}
	return results
}

func (hc *HealthChecker) GetCachedResult(serviceID string) (ServiceHealthResult, bool) {
	hc.mu.RLock()
	defer hc.mu.RUnlock()
	r, ok := hc.cache[serviceID]
	return r, ok
}

func (hc *HealthChecker) checkAll(ctx context.Context) {
	services, err := hc.store.ListServices(ctx)
	if err != nil {
		hc.log.Error("failed to list services for health check", "error", err)
		return
	}

	var wg sync.WaitGroup
	sem := make(chan struct{}, 4)

	for _, svc := range services {
		if strings.TrimSpace(svc.HealthURL) == "" {
			continue
		}
		wg.Add(1)
		go func(svc ServiceRecord) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			result := hc.CheckOne(ctx, svc)

			hc.mu.Lock()
			prev := hc.cache[svc.ID]
			hc.cache[svc.ID] = result
			hc.mu.Unlock()

			_ = hc.store.UpdateServiceHealth(ctx, svc.ID, result.Status, result.StatusCode, result.Error)

			if prev.Status != "" && prev.Status != result.Status {
				transition := HealthTransition{
					ServiceID: svc.ID,
					Current:   result,
				}
				if prev.Status != "" {
					cp := prev
					transition.Previous = &cp
				}
				hc.publishTransition(transition, svc.Name)
			}

			hc.log.Debug("health check complete", "service", svc.Name, "status", result.Status)
		}(svc)
	}
	wg.Wait()
}

func (hc *HealthChecker) publishTransition(transition HealthTransition, serviceName string) {
	hc.mu.RLock()
	for _, ch := range hc.subscribers {
		select {
		case ch <- transition:
		default:
			hc.log.Warn("health event subscriber full, dropping transition", "service", serviceName)
		}
	}
	hc.mu.RUnlock()
}

func (hc *HealthChecker) CheckOne(ctx context.Context, svc ServiceRecord) ServiceHealthResult {
	result := ServiceHealthResult{
		ServiceID: svc.ID,
		Status:    "unhealthy",
		CheckedAt: now().Format(time.RFC3339),
	}

	if _, err := ValidateHealthURL(svc.HealthURL); err != nil {
		result.Error = fmt.Sprintf("ssrf check failed: %v", err)
		_ = hc.store.UpdateServiceHealth(ctx, svc.ID, result.Status, 0, result.Error)
		return result
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, svc.HealthURL, nil)
	if err != nil {
		result.Error = err.Error()
		_ = hc.store.UpdateServiceHealth(ctx, svc.ID, result.Status, 0, result.Error)
		return result
	}

	resp, err := hc.client.Do(req)
	if err != nil {
		result.Error = err.Error()
		_ = hc.store.UpdateServiceHealth(ctx, svc.ID, result.Status, 0, result.Error)
		return result
	}
	defer resp.Body.Close()
	_, _ = io.CopyN(io.Discard, resp.Body, maxHealthBody)

	result.StatusCode = resp.StatusCode
	if resp.StatusCode >= 200 && resp.StatusCode < 400 {
		result.Status = "healthy"
	}
	return result
}
