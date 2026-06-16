package sqlutil

import "database/sql"

type Scanner interface {
	Scan(dest ...any) error
}

func RequireRowsAffected(result sql.Result) error {
	affected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return sql.ErrNoRows
	}
	return nil
}
