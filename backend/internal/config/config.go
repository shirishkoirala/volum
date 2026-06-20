package config

import (
	"errors"
	"os"
	"strconv"
	"strings"

	"github.com/volum-app/volum/backend/internal/security"
)

type Config struct {
	Roots          []security.Root
	DB             string
	Port           string
	SessionSecret  string
	AuthRequired   bool
	HostRoot       string
	PublicURL      string
	BootstrapToken string
}

func Load() (Config, error) {
	hostRoot := strings.TrimSpace(os.Getenv("VOLUM_HOST_ROOT"))
	includeRoot := parseBool(os.Getenv("VOLUM_INCLUDE_ROOT"))
	discoverRoots := parseBool(os.Getenv("VOLUM_DISCOVER_ROOTS"))

	homeRoot := strings.TrimSpace(os.Getenv("VOLUM_HOME"))
	roots, err := loadRoots(os.Getenv("VOLUM_ROOTS"), hostRoot, includeRoot, discoverRoots, homeRoot)
	if err != nil {
		return Config{}, err
	}

	db := os.Getenv("VOLUM_DB")
	if db == "" {
		db = "./volum.db"
	}

	port := os.Getenv("VOLUM_PORT")
	if port == "" {
		port = "8090"
	}
	if _, err := strconv.Atoi(port); err != nil {
		return Config{}, errors.New("VOLUM_PORT must be a number")
	}

	cfg := Config{
		Roots:          roots,
		DB:             db,
		Port:           port,
		SessionSecret:  os.Getenv("VOLUM_SESSION_SECRET"),
		AuthRequired:   parseBool(os.Getenv("VOLUM_AUTH_REQUIRED")),
		HostRoot:       hostRoot,
		PublicURL:      os.Getenv("VOLUM_PUBLIC_URL"),
		BootstrapToken: os.Getenv("VOLUM_BOOTSTRAP_TOKEN"),
	}

	secret := strings.TrimSpace(cfg.SessionSecret)

	if (includeRoot || discoverRoots) && !cfg.AuthRequired {
		return Config{}, errors.New("VOLUM_AUTH_REQUIRED must be true when root exposure or discovery is enabled")
	}

	if cfg.AuthRequired && secret == "" {
		return Config{}, errors.New("VOLUM_SESSION_SECRET is required when VOLUM_AUTH_REQUIRED=true")
	}

	if cfg.AuthRequired && secret != "" && len(secret) < 32 {
		return Config{}, errors.New("VOLUM_SESSION_SECRET must be at least 32 characters long")
	}

	return cfg, nil
}

func loadRoots(value, hostRoot string, includeRoot, discoverRoots bool, homeRoot string) ([]security.Root, error) {
	roots := make([]security.Root, 0)
	if includeRoot {
		roots = append(roots, rootSpec("/", hostRoot, "Server root", "", "", true))
	}
	if discoverRoots {
		discovered, err := discoverMountRoots(hostRoot)
		if err != nil {
			return nil, err
		}
		roots = append(roots, discovered...)
	}
	explicit, err := parseRoots(value, hostRoot)
	if err != nil {
		return nil, err
	}
	roots = append(roots, explicit...)
	roots = dedupeRoots(roots)
	if homeRoot != "" {
		homePath, err := security.CleanAbs(homeRoot)
		if err == nil {
			found := false
			for i, r := range roots {
				if r.Path == homePath {
					roots[i].IsHome = true
					roots[i].Label = "Home"
					found = true
					break
				}
			}
			if !found {
				r := rootSpec(homePath, hostRoot, "Home", "", "", false)
				r.IsHome = true
				roots = append(roots, r)
			}
		}
	}
	if len(roots) == 0 {
		return nil, errors.New("no roots configured; set VOLUM_ROOTS or enable VOLUM_INCLUDE_ROOT/VOLUM_DISCOVER_ROOTS")
	}
	return roots, nil
}

func parseRoots(value, hostRoot string) ([]security.Root, error) {
	if strings.TrimSpace(value) == "" {
		return nil, nil
	}

	raw := strings.Split(value, ",")
	roots := make([]security.Root, 0, len(raw))
	for _, root := range raw {
		root = strings.TrimSpace(root)
		if root == "" {
			continue
		}
		publicPath, err := security.CleanAbs(root)
		if err != nil {
			return nil, err
		}
		roots = append(roots, rootSpec(publicPath, hostRoot, "", "", "", false))
	}
	return roots, nil
}

func parseBool(value string) bool {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "1", "true", "yes", "on":
		return true
	default:
		return false
	}
}
