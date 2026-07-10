# Visual Audit Tools

Playwright-based visual regression testing. Run from the repo root via Makefile:

```
make setup-visual    # Install Playwright + Chromium
make visual-capture  # Capture reference screenshots
make visual-audit    # Compare current UI against references
```

This package is not included in the main `frontend/` build or CI format/lint checks. It exists as a standalone dependency to avoid adding Playwright to the frontend's production dependencies.
