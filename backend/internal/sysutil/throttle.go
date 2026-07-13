package sysutil

import "time"

type Throttle struct {
	lastBytes int64
	lastTime  time.Time
	minBytes  int64
	minPeriod time.Duration
}

func NewThrottle(startBytes int64, minBytes int64, minPeriod time.Duration) *Throttle {
	return &Throttle{
		lastBytes: startBytes,
		lastTime:  time.Now(),
		minBytes:  minBytes,
		minPeriod: minPeriod,
	}
}

func (t *Throttle) Ready(currentBytes int64) bool {
	now := time.Now()
	if currentBytes-t.lastBytes < t.minBytes && now.Sub(t.lastTime) < t.minPeriod {
		return false
	}
	t.lastBytes = currentBytes
	t.lastTime = now
	return true
}
