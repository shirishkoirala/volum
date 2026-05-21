package config

import (
	"errors"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

type Config struct {
	Roots []string
	DB    string
	Port  string
}

func Load() (Config, error) {
	roots, err := parseRoots(os.Getenv("VOLUM_ROOTS"))
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

	return Config{Roots: roots, DB: db, Port: port}, nil
}

func parseRoots(value string) ([]string, error) {
	if strings.TrimSpace(value) == "" {
		return nil, errors.New("VOLUM_ROOTS is required")
	}

	raw := strings.Split(value, ",")
	roots := make([]string, 0, len(raw))
	for _, root := range raw {
		root = strings.TrimSpace(root)
		if root == "" {
			continue
		}
		abs, err := filepath.Abs(root)
		if err != nil {
			return nil, err
		}
		clean := filepath.Clean(abs)
		roots = append(roots, clean)
	}
	if len(roots) == 0 {
		return nil, errors.New("VOLUM_ROOTS did not contain any usable roots")
	}
	return roots, nil
}
