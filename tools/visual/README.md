# Visual Capture Tools

Playwright-based screenshot capture. Run from the repo root via Makefile:

```
make setup-visual    # Install Playwright + Chromium
make visual-capture  # Capture reference screenshots
```

This package is not included in the main `frontend/` build or CI format/lint checks. It exists as a standalone dependency to avoid adding Playwright to the frontend's production dependencies.
