# Add a Frontend Setting

Use this path for a preference stored in the browser or backed by an existing
API. A setting that changes server security or shared server behavior needs a
backend design first.

## 1. Define ownership

Decide whether the value belongs to:

- Browser-only preferences in `localStorage`
- Session/user data returned by the API
- Server configuration through environment variables
- Shared database state

Do not store secrets in `localStorage`.

## 2. Add reusable state

For a browser preference, use a focused hook under `frontend/src/hooks/`.
The hook should:

- Define a default
- Validate persisted values
- Handle unavailable or malformed storage
- Expose a typed value and update function
- Keep storage keys stable

Pure parsing or conversion belongs in `frontend/src/utils/`.

## 3. Add the control

Settings page controls live in `frontend/src/pages/SettingsPanel.tsx`. Extract
a category component if the change would add another unrelated concern to that
file.

Use the established control for the value:

- Checkbox or toggle for a boolean
- Select/menu for a small option set
- Numeric input, stepper, or slider for a bounded number
- Color swatch or picker for color

Include disabled, loading, and error states when persistence is asynchronous.
Use design tokens and the colocated CSS Module.

## 4. Wire behavior

Consume the hook at the narrowest common owner. Avoid moving state to
`Home.tsx` unless multiple workspace areas genuinely share it.

Do not read `localStorage` in multiple components for the same preference.

## 5. Test

Add tests under `frontend/src/test/` for:

- Default value
- Persisted valid value
- Invalid persisted value
- User changing the control
- Behavior that consumes the setting
- Accessible name and keyboard operation

Prefer role and label queries.

## 6. Verify

```sh
make check-frontend
make dev
```

Manually verify the setting at desktop and narrow widths, reload the page, and
confirm persistence.

## Pull request notes

State where the value is stored, its default, whether it affects other users,
and how older stored values are handled.
