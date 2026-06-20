package storage

import (
	"database/sql"
	"os"
	"path/filepath"
	"testing"
)

func TestOpenCreatesDatabase(t *testing.T) {
	dbPath := filepath.Join(t.TempDir(), "test.db")
	db, err := Open(dbPath)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	if _, err := os.Stat(dbPath); os.IsNotExist(err) {
		t.Fatal("expected database file to exist")
	}
}

func TestOpenCreatesParentDirectories(t *testing.T) {
	dbPath := filepath.Join(t.TempDir(), "nested", "dir", "test.db")
	db, err := Open(dbPath)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	if _, err := os.Stat(filepath.Dir(dbPath)); os.IsNotExist(err) {
		t.Fatal("expected parent directory to exist")
	}
}

func TestOpenAppliesMigrations(t *testing.T) {
	db, err := Open(filepath.Join(t.TempDir(), "migrated.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	tables := []string{"jobs", "job_items", "audit_logs", "shares", "desktop_services"}
	for _, table := range tables {
		var name string
		err := db.QueryRow("SELECT name FROM sqlite_master WHERE type='table' AND name=?", table).Scan(&name)
		if err == sql.ErrNoRows {
			t.Fatalf("expected table %s to exist", table)
		}
		if err != nil {
			t.Fatal(err)
		}
	}
}

func TestMigrateAddsDesktopServiceHealthURL(t *testing.T) {
	db, err := Open(filepath.Join(t.TempDir(), "services.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	var name string
	err = db.QueryRow("SELECT name FROM pragma_table_info('desktop_services') WHERE name='health_url'").Scan(&name)
	if err == sql.ErrNoRows {
		t.Fatal("expected health_url column to exist")
	}
	if err != nil {
		t.Fatal(err)
	}
}

func TestMigrateAddsUserAvatarColumns(t *testing.T) {
	db, err := Open(filepath.Join(t.TempDir(), "users.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	for _, column := range []string{"avatar_data", "avatar_mime"} {
		var name string
		err = db.QueryRow("SELECT name FROM pragma_table_info('users') WHERE name = ?", column).Scan(&name)
		if err == sql.ErrNoRows {
			t.Fatalf("expected %s column to exist", column)
		}
		if err != nil {
			t.Fatal(err)
		}
	}
}

func TestOpenIdempotent(t *testing.T) {
	dbPath := filepath.Join(t.TempDir(), "twice.db")
	db1, err := Open(dbPath)
	if err != nil {
		t.Fatal(err)
	}
	db1.Close()

	db2, err := Open(dbPath)
	if err != nil {
		t.Fatal(err)
	}
	db2.Close()
}

func TestMigrateIdempotent(t *testing.T) {
	db, err := sql.Open("sqlite3", filepath.Join(t.TempDir(), "migrate.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	if err := migrate(db); err != nil {
		t.Fatal(err)
	}
	if err := migrate(db); err != nil {
		t.Fatal("expected migrate to be idempotent, got: ", err)
	}
}

func TestAddColumnIfMissingNewColumn(t *testing.T) {
	db, err := Open(filepath.Join(t.TempDir(), "addcolumn.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	if err := addColumnIfMissing(db, "jobs", "test_col", "TEXT"); err != nil {
		t.Fatal(err)
	}

	var name string
	err = db.QueryRow("SELECT name FROM pragma_table_info('jobs') WHERE name='test_col'").Scan(&name)
	if err == sql.ErrNoRows {
		t.Fatal("expected test_col column to exist")
	}
	if err != nil {
		t.Fatal(err)
	}
}

func TestAddColumnIfMissingDuplicateColumn(t *testing.T) {
	db, err := Open(filepath.Join(t.TempDir(), "dupecol.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	if err := addColumnIfMissing(db, "jobs", "test_col", "TEXT"); err != nil {
		t.Fatal(err)
	}
	if err := addColumnIfMissing(db, "jobs", "test_col", "TEXT"); err != nil {
		t.Fatal("expected duplicate column to be silently ignored, got: ", err)
	}
}

func TestSetMaxOpenConns(t *testing.T) {
	db, err := Open(filepath.Join(t.TempDir(), "conns.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	if db.Stats().MaxOpenConnections != 1 {
		t.Fatalf("expected MaxOpenConnections=1, got %d", db.Stats().MaxOpenConnections)
	}
}
