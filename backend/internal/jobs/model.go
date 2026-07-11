package jobs

import "time"

type Type string

const (
	TypeCopy     Type = "copy"
	TypeMove     Type = "move"
	TypeTrash    Type = "trash"
	TypeRestore  Type = "restore"
	TypeUpload   Type = "upload"
	TypeExtract  Type = "extract"
	TypeArchive  Type = "archive"
	TypeChecksum Type = "checksum"
)

type Status string

const (
	StatusQueued         Status = "queued"
	StatusRunning        Status = "running"
	StatusPaused         Status = "paused"
	StatusCompleted      Status = "completed"
	StatusFailed         Status = "failed"
	StatusCancelled      Status = "cancelled"
	StatusNeedsAttention Status = "needs_attention"
	StatusConflict       Status = "conflict"
)

type Job struct {
	ID              string     `json:"id"`
	Type            Type       `json:"type"`
	Status          Status     `json:"status"`
	SourcePath      *string    `json:"sourcePath,omitempty"`
	DestinationPath *string    `json:"destinationPath,omitempty"`
	TotalBytes      int64      `json:"totalBytes"`
	ProcessedBytes  int64      `json:"processedBytes"`
	SpeedBytesSec   float64    `json:"speedBytesPerSecond,omitempty"`
	ETASeconds      *int64     `json:"etaSeconds,omitempty"`
	TotalItems      int64      `json:"totalItems"`
	ProcessedItems  int64      `json:"processedItems"`
	CurrentItem     *string    `json:"currentItem,omitempty"`
	ErrorMessage    *string    `json:"errorMessage,omitempty"`
	ConflictPolicy  string     `json:"conflictPolicy"`
	VerifyMode      string     `json:"verifyMode"`
	CreatedAt       time.Time  `json:"createdAt"`
	UpdatedAt       time.Time  `json:"updatedAt"`
	StartedAt       *time.Time `json:"startedAt,omitempty"`
	CompletedAt     *time.Time `json:"completedAt,omitempty"`
}

type Item struct {
	ID                 string    `json:"id"`
	JobID              string    `json:"jobId"`
	SourcePath         string    `json:"sourcePath"`
	DestinationPath    string    `json:"destinationPath"`
	TempPath           *string   `json:"tempPath,omitempty"`
	SizeBytes          int64     `json:"sizeBytes"`
	ProcessedBytes     int64     `json:"processedBytes"`
	Status             Status    `json:"status"`
	ErrorMessage       *string   `json:"errorMessage,omitempty"`
	Checksum           *string   `json:"checksum,omitempty"`
	ConflictResolution *string   `json:"conflictResolution,omitempty"`
	CreatedAt          time.Time `json:"createdAt"`
	UpdatedAt          time.Time `json:"updatedAt"`
}

type CreateRequest struct {
	Type            Type   `json:"type"`
	SourcePath      string `json:"sourcePath"`
	DestinationPath string `json:"destinationPath"`
	ConflictPolicy  string `json:"conflictPolicy"`
	VerifyMode      string `json:"verifyMode"`
}

type AuditLog struct {
	ID        string    `json:"id"`
	UserID    *string   `json:"userId,omitempty"`
	Action    string    `json:"action"`
	Path      *string   `json:"path,omitempty"`
	Details   *string   `json:"details,omitempty"`
	CreatedAt time.Time `json:"createdAt"`
}
