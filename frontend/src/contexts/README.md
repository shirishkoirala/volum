# React Contexts

Three independent context providers used across the workspace:

- **`ShellContext`** — shared workspace actions: toast notifications, navigation, and file-browser refresh. Provided by `Home.tsx`. Accessed via `useShellContext()`.

- **`CommandsContext`** + **`WindowIdContext`** (`WindowCommands.ts`) — window command routing. Each window (files view, desktop, etc.) registers its available actions (`cut`, `copy`, `paste`, etc.) under a window ID. The menu bar and keyboard shortcuts dispatch commands to the active window by looking up its registered handler. Accessed via `useCommandsContext()` and `useWindowId()`.

- **`WindowManager`** (`WindowManager.tsx` + `WindowManagerProvider.tsx`) — desktop window state: open/close/minimize/maximize/z-order of preview, service, and settings windows. Provided near the root by `WindowManagerProvider`. Accessed via `useWindowManager()`.
