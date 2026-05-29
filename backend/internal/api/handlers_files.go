package api

import (
	"archive/zip"
	"encoding/json"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
)

func (s *Server) handleFiles(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Query().Get("path")
	showHidden := r.URL.Query().Get("hidden") == "true"
	entries, err := s.files.List(path, showHidden)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"entries": entries})
}

func (s *Server) handleCreateFile(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Path string `json:"path"`
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
		return
	}

	entry, err := s.files.CreateFile(req.Path, req.Name)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, entry)
}

func (s *Server) handleCreateFolder(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Path string `json:"path"`
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
		return
	}

	entry, err := s.files.CreateFolder(req.Path, req.Name)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, entry)
}

func (s *Server) handleRename(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Path    string `json:"path"`
		NewName string `json:"newName"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
		return
	}

	entry, err := s.files.Rename(req.Path, req.NewName)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, entry)
}

type batchRenameItem struct {
	Path    string `json:"path"`
	NewName string `json:"newName"`
}

func (s *Server) handleBatchRename(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Items []batchRenameItem `json:"items"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
		return
	}
	if len(req.Items) == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "no items provided"})
		return
	}

	errs := make([]map[string]string, 0)
	for _, item := range req.Items {
		if _, err := s.files.Rename(item.Path, item.NewName); err != nil {
			errs = append(errs, map[string]string{"path": item.Path, "error": err.Error()})
		}
	}

	if len(errs) > 0 {
		writeJSON(w, http.StatusOK, map[string]any{"errors": errs, "complete": len(req.Items) - len(errs)})
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleDelete(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Path        string `json:"path"`
		ConfirmName string `json:"confirmName"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
		return
	}
	if req.ConfirmName == "" || filepath.Base(req.Path) != req.ConfirmName {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "delete confirmation did not match selected item"})
		return
	}

	entry, err := s.files.Trash(req.Path)
	if err != nil {
		writeError(w, err)
		return
	}
	if err := s.jobs.CreateAuditLog(r.Context(), "trash", req.Path, "moved to trash "+entry.ID); err != nil {
		writeError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleDownload(w http.ResponseWriter, r *http.Request) {
	path, info, err := s.files.DownloadPath(r.URL.Query().Get("path"))
	if err != nil {
		writeError(w, err)
		return
	}

	if !info.IsDir() {
		w.Header().Set("Content-Disposition", "attachment; filename="+strconv.Quote(info.Name()))
		http.ServeFile(w, r, path)
		return
	}

	w.Header().Set("Content-Type", "application/zip")
	w.Header().Set("Content-Disposition", "attachment; filename="+strconv.Quote(info.Name()+".zip"))
	zw := zip.NewWriter(w)
	defer zw.Close()

	err = filepath.WalkDir(path, func(filePath string, entry os.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		rel, err := filepath.Rel(path, filePath)
		if err != nil {
			return err
		}
		if rel == "." {
			return nil
		}
		info, err := entry.Info()
		if err != nil {
			return err
		}
		header, err := zip.FileInfoHeader(info)
		if err != nil {
			return err
		}
		header.Name = filepath.ToSlash(rel)
		header.Method = zip.Deflate
		if entry.IsDir() {
			header.Name += "/"
			_, err := zw.CreateHeader(header)
			return err
		}
		w, err := zw.CreateHeader(header)
		if err != nil {
			return err
		}
		f, err := os.Open(filePath)
		if err != nil {
			return err
		}
		defer f.Close()
		_, err = io.Copy(w, f)
		return err
	})
	if err != nil {
		writeError(w, err)
	}
}

func (s *Server) handleSearch(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query().Get("q")
	limitParam := r.URL.Query().Get("limit")
	limit := 50
	if v, err := strconv.Atoi(limitParam); err == nil && v > 0 && v <= 200 {
		limit = v
	}
	results, err := s.files.Search(query, limit)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"results": results})
}

func (s *Server) handleDirSizes(w http.ResponseWriter, r *http.Request) {
	parentPath := r.URL.Query().Get("path")
	if parentPath == "" {
		writeJSON(w, http.StatusOK, map[string]any{"sizes": map[string]int64{}})
		return
	}

	resolved, err := s.guard.Resolve(parentPath)
	if err != nil {
		writeError(w, err)
		return
	}
	items, err := os.ReadDir(resolved)
	if err != nil {
		writeError(w, err)
		return
	}

	publicPaths := make([]string, 0, len(items))
	for _, item := range items {
		if !item.IsDir() {
			continue
		}
		itemPath := filepath.Join(resolved, item.Name())
		publicPath, err := s.guard.PublicPath(itemPath)
		if err != nil {
			continue
		}
		publicPaths = append(publicPaths, publicPath)
	}

	sizes := s.files.GetDirSizes(publicPaths)
	writeJSON(w, http.StatusOK, map[string]any{"sizes": sizes})
}

func (s *Server) handleAnalyzeDiskUsage(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Query().Get("path")
	if path == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "path is required"})
		return
	}
	node, err := s.files.AnalyzeDiskUsage(path)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, node)
}

func (s *Server) handleRaw(w http.ResponseWriter, r *http.Request) {
	path, info, err := s.files.DownloadPath(r.URL.Query().Get("path"))
	if err != nil {
		writeError(w, err)
		return
	}

	w.Header().Set("Content-Disposition", "inline; filename="+strconv.Quote(info.Name()))
	http.ServeFile(w, r, path)
}

func (s *Server) handleChmod(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Path string `json:"path"`
		Mode string `json:"mode"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
		return
	}
	if req.Path == "" || req.Mode == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "path and mode are required"})
		return
	}
	entry, err := s.files.Chmod(req.Path, req.Mode)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, entry)
}


