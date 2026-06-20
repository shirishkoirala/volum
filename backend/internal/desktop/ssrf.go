package desktop

import (
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"strings"
)

var errBlockedDestination = errors.New("health check URL targets a blocked destination")

func ValidateHealthURLScheme(rawURL string) error {
	u, err := url.Parse(rawURL)
	if err != nil {
		return fmt.Errorf("invalid health check URL: %w", err)
	}
	if u.Scheme != "http" && u.Scheme != "https" {
		return errors.New("health check URL must use http or https scheme")
	}
	if u.Hostname() == "" {
		return errors.New("health check URL has no host")
	}
	return nil
}

func ValidateHealthURL(rawURL string) (*url.URL, error) {
	u, err := url.Parse(rawURL)
	if err != nil {
		return nil, fmt.Errorf("invalid health check URL: %w", err)
	}

	if u.Scheme != "http" && u.Scheme != "https" {
		return nil, errors.New("health check URL must use http or https scheme")
	}

	host := u.Hostname()
	if host == "" {
		return nil, errors.New("health check URL has no host")
	}

	ips, err := net.LookupHost(host)
	if err != nil {
		return nil, fmt.Errorf("health check URL hostname resolution failed: %w", err)
	}

	for _, ip := range ips {
		if isBlockedIP(net.ParseIP(ip)) {
			return nil, fmt.Errorf("%w: %s resolves to blocked address %s", errBlockedDestination, host, ip)
		}
	}

	return u, nil
}

func isBlockedIP(ip net.IP) bool {
	if ip == nil {
		return false
	}

	// Allow loopback — admin-created services may check local processes.
	if ip.IsLoopback() {
		return false
	}

	if ip.IsPrivate() || ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() ||
		ip.IsMulticast() || ip.IsUnspecified() {
		return true
	}

	return false
}

func redirectBlocked(req *http.Request, via []*http.Request) error {
	if len(via) >= 10 {
		return errors.New("too many redirects in health check")
	}

	redirectURL := req.URL.String()
	if _, err := ValidateHealthURL(redirectURL); err != nil {
		return err
	}

	return nil
}

func parseHealthURL(raw string) (string, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "", nil
	}

	u, err := ValidateHealthURL(raw)
	if err != nil {
		return "", err
	}

	return u.String(), nil
}
