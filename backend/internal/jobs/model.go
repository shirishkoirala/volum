package jobs

import "time"

type Type string

const (
	TypeCopy     Type = "copy"
	TypeMove     Type = "move"
	TypeDelete   Type = "delete"
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
)

type Job struct {
	ID               string     `json:"id"`
	Type             Type       `json:"type"`
	Status           Status     `json:"status"`
	SourcePath       *string    `json:"sourcePath,omitempty"`
	DestinationPath  *string    `json:"destinationPath,omitempty"`
	TotalBytes       int64      `json:"totalBytes"`
	ProcessedBytes   int64      `json:"processedBytes"`
	TotalItems       int64      `json:"totalItems"`
	ProcessedItems   int64      `json:"processedItems"`
	CurrentItem      *string    `json:"currentItem,omitempty"`
	ErrorMessage     *string    `json:"errorMessage,omitempty"`
	ConflictPolicy   string     `json:"conflictPolicy"`
	VerifyMode       string     `json:"verifyMode"`
	CreatedAt        time.Time  `json:"createdAt"`
	UpdatedAt        time.Time  `json:"updatedAt"`
	StartedAt        *time.Time `json:"startedAt,omitempty"`
	CompletedAt      *time.Time `json:"completedAt,omitempty"`
}

type CreateRequest struct {
	Type            Type   `json:"type"`
	SourcePath      string `json:"sourcePath"`
	DestinationPath string `json:"destinationPath"`
	ConflictPolicy  string `json:"conflictPolicy"`
	VerifyMode      string `json:"verifyMode"`
}
