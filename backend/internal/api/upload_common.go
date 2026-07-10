package api

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/volum-app/volum/backend/internal/files"
	"github.com/volum-app/volum/backend/internal/jobs"
	"github.com/volum-app/volum/backend/internal/security"
)

const (
	maxUploadChunkBytes     int64 = 2 * 1024 * 1024
	maxAggregateUploadBytes int64 = 20 * 1024 * 1024 * 1024
)

type uploadFinalizeRequest struct {
	jobID             string
	itemID            string
	tempPath          string
	destination       string
	destinationPublic string
	uploadName        string
	name              string
	bytes             int64
	conflictPolicy    string
	cleanupPaths      []string
}

func (s *Server) finalizeUpload(ctx context.Context, req uploadFinalizeRequest) (jobs.Job, error) {
	destination := req.destination
	destinationPublic := req.destinationPublic
	name := req.name

	finalDestination, err := s.resolveUploadConflict(destination, req.conflictPolicy)
	if err != nil {
		return jobs.Job{}, err
	}
	if finalDestination != destination {
		destination = finalDestination
		if publicPath, err := s.guard.PublicPath(destination); err == nil {
			destinationPublic = publicPath
		}
		name = filepath.Base(destinationPublic)
	}

	if err := s.guard.RenameNoReplace(req.tempPath, destination); err != nil {
		return jobs.Job{}, err
	}
	for _, path := range req.cleanupPaths {
		s.cleanupUploadPaths(path)
	}
	s.cleanupUploadPaths(filepath.Dir(req.tempPath))

	if appBundle, converted, err := s.finalizeAppBundleArchive(destination, req.uploadName, req.conflictPolicy); err != nil {
		return jobs.Job{}, err
	} else if converted {
		destinationPublic = appBundle.publicPath
		name = appBundle.filename
	}

	if name != req.name || destinationPublic != req.destinationPublic {
		if err := s.jobs.UpdateJobPaths(ctx, req.jobID, name, destinationPublic); err != nil {
			return jobs.Job{}, err
		}
	}
	if err := s.jobs.SetJobTotals(ctx, req.jobID, req.bytes, 1); err != nil {
		return jobs.Job{}, err
	}
	if req.itemID != "" {
		if err := s.jobs.UpdateItemStatus(ctx, req.itemID, jobs.StatusCompleted, req.bytes, nil); err != nil {
			return jobs.Job{}, err
		}
	}
	if err := s.jobs.UpdateJobProgress(ctx, req.jobID, req.bytes, 1, name); err != nil {
		return jobs.Job{}, err
	}
	if err := s.jobs.CompleteJob(ctx, req.jobID); err != nil {
		return jobs.Job{}, err
	}
	if err := s.jobs.CreateAuditLog(ctx, "upload", destinationPublic, "uploaded "+name); err != nil {
		return jobs.Job{}, err
	}
	return s.jobs.Get(ctx, req.jobID)
}

func validUploadName(name string) bool {
	return security.ValidBaseName(name) && !strings.ContainsAny(name, `/\`)
}

type uploadSizeQueue struct {
	sizes map[string][]int64
}

type uploadManifestItem struct {
	Name string `json:"name"`
	Size int64  `json:"size"`
}

func newUploadSizeQueue() *uploadSizeQueue {
	return &uploadSizeQueue{sizes: make(map[string][]int64)}
}

func (q *uploadSizeQueue) Read(reader io.Reader) error {
	var items []uploadManifestItem
	if err := json.NewDecoder(reader).Decode(&items); err != nil {
		return err
	}
	for _, item := range items {
		if !validUploadName(filepath.Base(item.Name)) || item.Size < 0 {
			return files.ErrInvalidName
		}
		name := filepath.Base(item.Name)
		q.sizes[name] = append(q.sizes[name], item.Size)
	}
	return nil
}

func (q *uploadSizeQueue) Take(name string) int64 {
	name = filepath.Base(name)
	values := q.sizes[name]
	if len(values) == 0 {
		return 0
	}
	value := values[0]
	q.sizes[name] = values[1:]
	return value
}

func uploadConflictPolicy(r *http.Request) string {
	switch r.URL.Query().Get("conflictPolicy") {
	case "ask", "overwrite", "rename":
		return r.URL.Query().Get("conflictPolicy")
	default:
		return "rename"
	}
}

func (s *Server) cleanupUploadPaths(paths ...string) {
	for _, path := range paths {
		_ = s.guard.Remove(path)
	}
}

func (s *Server) writeUploadState(path string, data []byte) error {
	file, err := s.guard.OpenFile(path, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o600)
	if err != nil {
		return err
	}
	if _, err := file.Write(data); err != nil {
		file.Close()
		return err
	}
	return file.Close()
}

func (s *Server) resolveUploadConflict(destination, policy string) (string, error) {
	if _, err := os.Stat(destination); errors.Is(err, os.ErrNotExist) {
		return destination, nil
	} else if err != nil {
		return "", err
	}

	switch policy {
	case "overwrite":
		return destination, s.guard.RemoveAll(destination)
	case "rename":
		return s.guard.NextAvailablePath(destination)
	default:
		return "", files.ErrDestinationExists
	}
}
