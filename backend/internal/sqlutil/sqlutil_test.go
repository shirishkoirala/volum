package sqlutil

import (
	"database/sql"
	"errors"
	"testing"
)

type mockResult struct {
	affected int64
	err      error
}

func (m mockResult) LastInsertId() (int64, error) { return 0, nil }
func (m mockResult) RowsAffected() (int64, error) { return m.affected, m.err }

func TestRequireRowsAffectedSuccess(t *testing.T) {
	err := RequireRowsAffected(mockResult{affected: 1})
	if err != nil {
		t.Fatalf("expected nil, got %v", err)
	}
}

func TestRequireRowsAffectedZero(t *testing.T) {
	err := RequireRowsAffected(mockResult{affected: 0})
	if !errors.Is(err, sql.ErrNoRows) {
		t.Fatalf("expected sql.ErrNoRows, got %v", err)
	}
}

func TestRequireRowsAffectedError(t *testing.T) {
	expected := errors.New("rows error")
	err := RequireRowsAffected(mockResult{err: expected})
	if !errors.Is(err, expected) {
		t.Fatalf("expected %v, got %v", expected, err)
	}
}
