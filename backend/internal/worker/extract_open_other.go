//go:build !linux

package worker

import (
	"errors"
	"os"
)

var errSecureExtractionUnsupported = errors.New("secure archive extraction is supported only on Linux")

func ensureExtractDir(_, _ string) error {
	return errSecureExtractionUnsupported
}

func openExtractFile(_, _ string) (*os.File, error) {
	return nil, errSecureExtractionUnsupported
}
