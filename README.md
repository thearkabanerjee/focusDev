# FocusDev — VS Code Extension (JavaScript)

FocusDev is a Pomodoro-style timer that runs inside a VS Code Webview. It shows an animated cute face, a progress ring, supports start/pause/reset/skip, and persists a total sessions counter.

## Run locally

1. Open this folder in VS Code.
2. Press `F5` to launch an Extension Development Host.
3. In the new host window, open the Command Palette (`Ctrl/Cmd+Shift+P`) and run `FocusDev: Open Timer`.

## Settings

Open Settings and search for `FocusDev` to change:
- Work duration (`focusDev.workMinutes`)
- Short break duration (`focusDev.breakMinutes`)
- Long break duration (`focusDev.longBreakMinutes`)
- Long break interval (`focusDev.longBreakInterval`)
- Auto-start next session (`focusDev.autoStartNext`)

## Notes

- No external assets required: UI uses inline SVG animation.
- The extension persists a global total session count in VS Code's `globalState`.

