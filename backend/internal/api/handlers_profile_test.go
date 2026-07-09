package api

import (
	"bytes"
	"image"
	"image/color"
	"image/png"
	"io"
	"net/http"
	"testing"
)

func TestProfileAvatarLifecycle(t *testing.T) {
	ts, cleanup := setupTestServer(t)
	defer cleanup()

	var pngData bytes.Buffer
	img := image.NewRGBA(image.Rect(0, 0, 2, 2))
	img.Set(0, 0, color.RGBA{R: 40, G: 120, B: 220, A: 255})
	if err := png.Encode(&pngData, img); err != nil {
		t.Fatal(err)
	}

	putResp := ts.uploadAvatar(t, pngData.Bytes(), "avatar.png")
	if putResp.StatusCode != http.StatusOK {
		t.Fatalf("expected avatar upload 200, got %d", putResp.StatusCode)
	}
	var avatarState struct {
		HasAvatar     bool  `json:"hasAvatar"`
		AvatarVersion int64 `json:"avatarVersion"`
	}
	readJSON(t, putResp, &avatarState)
	if !avatarState.HasAvatar || avatarState.AvatarVersion == 0 {
		t.Fatalf("unexpected avatar state: %#v", avatarState)
	}

	getResp := ts.get("/api/profile/avatar")
	defer getResp.Body.Close()
	if getResp.StatusCode != http.StatusOK {
		t.Fatalf("expected avatar fetch 200, got %d", getResp.StatusCode)
	}
	if getResp.Header.Get("Content-Type") != "image/png" {
		t.Fatalf("expected image/png, got %q", getResp.Header.Get("Content-Type"))
	}
	gotData, err := io.ReadAll(getResp.Body)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(gotData, pngData.Bytes()) {
		t.Fatal("fetched avatar does not match upload")
	}

	sessionResp := ts.get("/api/session")
	var session struct {
		HasAvatar bool `json:"hasAvatar"`
	}
	readJSON(t, sessionResp, &session)
	if !session.HasAvatar {
		t.Fatal("expected session to report avatar")
	}

	deleteResp := ts.del("/api/profile/avatar", nil)
	if deleteResp.StatusCode != http.StatusOK {
		t.Fatalf("expected avatar delete 200, got %d", deleteResp.StatusCode)
	}
	deleteResp.Body.Close()
	missingResp := ts.get("/api/profile/avatar")
	missingResp.Body.Close()
	if missingResp.StatusCode != http.StatusNotFound {
		t.Fatalf("expected deleted avatar to return 404, got %d", missingResp.StatusCode)
	}
}

func TestProfileAvatarRejectsNonImage(t *testing.T) {
	ts, cleanup := setupTestServer(t)
	defer cleanup()

	resp := ts.uploadAvatar(t, []byte("not an image"), "avatar.txt")
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusUnsupportedMediaType {
		t.Fatalf("expected 415, got %d", resp.StatusCode)
	}
}
