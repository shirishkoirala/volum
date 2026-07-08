package desktop

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/netip"
	"net/url"
	"time"
)

var errBlockedDestination = errors.New("health check URL targets a blocked destination")

var blockedHealthPrefixes = []netip.Prefix{
	netip.MustParsePrefix("0.0.0.0/8"),
	netip.MustParsePrefix("100.64.0.0/10"),
	netip.MustParsePrefix("192.0.0.0/24"),
	netip.MustParsePrefix("192.0.2.0/24"),
	netip.MustParsePrefix("198.18.0.0/15"),
	netip.MustParsePrefix("198.51.100.0/24"),
	netip.MustParsePrefix("203.0.113.0/24"),
	netip.MustParsePrefix("240.0.0.0/4"),
	netip.MustParsePrefix("2001:db8::/32"),
}

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
		return true
	}

	if ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast() ||
		ip.IsLinkLocalMulticast() || ip.IsMulticast() || ip.IsUnspecified() ||
		!ip.IsGlobalUnicast() {
		return true
	}

	address, ok := netip.AddrFromSlice(ip)
	if !ok {
		return true
	}
	address = address.Unmap()
	for _, prefix := range blockedHealthPrefixes {
		if prefix.Contains(address) {
			return true
		}
	}

	return false
}

func safeDialContext(ctx context.Context, network, address string) (net.Conn, error) {
	host, port, err := net.SplitHostPort(address)
	if err != nil {
		return nil, err
	}
	addresses, err := net.DefaultResolver.LookupIPAddr(ctx, host)
	if err != nil {
		return nil, fmt.Errorf("health check hostname resolution failed: %w", err)
	}
	if len(addresses) == 0 {
		return nil, errors.New("health check hostname resolved to no addresses")
	}
	for _, address := range addresses {
		if isBlockedIP(address.IP) {
			return nil, fmt.Errorf("%w: %s resolves to blocked address %s", errBlockedDestination, host, address.IP)
		}
	}

	dialer := &net.Dialer{Timeout: 3 * time.Second}
	return dialer.DialContext(ctx, network, net.JoinHostPort(addresses[0].IP.String(), port))
}

func safeHealthTransport() *http.Transport {
	transport := http.DefaultTransport.(*http.Transport).Clone()
	transport.Proxy = nil
	transport.DialContext = safeDialContext
	return transport
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
