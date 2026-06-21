package desktop

import (
	"context"
	"errors"
	"net"
	"net/http/httptest"
	"testing"
)

func TestBlockedHealthAddresses(t *testing.T) {
	for _, address := range []string{
		"127.0.0.1",
		"::1",
		"10.0.0.1",
		"172.16.0.1",
		"192.168.0.1",
		"169.254.169.254",
		"100.64.0.1",
		"192.0.2.1",
		"198.18.0.1",
		"198.51.100.1",
		"203.0.113.1",
		"240.0.0.1",
		"2001:db8::1",
	} {
		if !isBlockedIP(net.ParseIP(address)) {
			t.Errorf("expected %s to be blocked", address)
		}
	}
}

func TestPublicHealthAddressAllowed(t *testing.T) {
	if isBlockedIP(net.ParseIP("8.8.8.8")) {
		t.Fatal("expected public address to be allowed")
	}
}

func TestSafeDialRejectsLoopback(t *testing.T) {
	_, err := safeDialContext(context.Background(), "tcp", "127.0.0.1:80")
	if !errors.Is(err, errBlockedDestination) {
		t.Fatalf("expected blocked destination error, got %v", err)
	}
}

func TestRedirectRejectsPrivateDestination(t *testing.T) {
	req := httptest.NewRequest("GET", "http://169.254.169.254/latest/meta-data", nil)
	if err := redirectBlocked(req, nil); !errors.Is(err, errBlockedDestination) {
		t.Fatalf("expected private redirect destination to be blocked, got %v", err)
	}
}
