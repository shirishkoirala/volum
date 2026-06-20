package api

import (
	"net"
	"net/http"
	"strings"
	"sync"
	"time"
)

type rateLimiter struct {
	mu       sync.Mutex
	visitors map[string]*visitor
	rate     int
	window   time.Duration
}

type visitor struct {
	count       int
	windowStart time.Time
	lastSeen    time.Time
}

func newRateLimiter(rate int, window time.Duration) *rateLimiter {
	rl := &rateLimiter{
		visitors: make(map[string]*visitor),
		rate:     rate,
		window:   window,
	}
	go rl.cleanup()
	return rl
}

func (rl *rateLimiter) cleanup() {
	for {
		time.Sleep(rl.window)
		rl.mu.Lock()
		now := time.Now()
		for ip, v := range rl.visitors {
			if now.Sub(v.lastSeen) > rl.window {
				delete(rl.visitors, ip)
			}
		}
		rl.mu.Unlock()
	}
}

func (rl *rateLimiter) allow(ip string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	v, exists := rl.visitors[ip]
	if !exists {
		rl.visitors[ip] = &visitor{count: 1, windowStart: now, lastSeen: now}
		return true
	}

	if now.Sub(v.windowStart) >= rl.window {
		v.count = 1
		v.windowStart = now
		v.lastSeen = now
		return true
	}
	v.lastSeen = now
	v.count++
	return v.count <= rl.rate
}

func clientIP(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err == nil {
		return host
	}
	return r.RemoteAddr
}

func (s *Server) allowLogin(r *http.Request, username string) bool {
	ip := clientIP(r)
	return s.loginLimiter.allow("login-ip:"+ip) &&
		s.loginLimiter.allow("login-pair:"+ip+":"+strings.ToLower(strings.TrimSpace(username)))
}

func (s *Server) allowSetup(r *http.Request) bool {
	return s.loginLimiter.allow("setup-ip:" + clientIP(r))
}
