# Copilot Instructions for hackatank

## Keep Electron and API parity in sync
- If you change the assistant response format, tool parsing, validation logic, or API payload shape in `api-server.js`, also mirror the same logic in `electron/main.js`.
- Treat the Electron app and the Node API server as two implementations of the same assistant behavior.
- Before finishing a change, compare both files and confirm they handle the same structured response formats, especially:
  - JSON content strings
  - array-based content payloads
  - object-based tool results
  - table payload validation
  - source metadata
- When fixing a bug in one path, apply the equivalent fix to the other path in the same change.

## General workflow
- Prefer minimal, targeted edits.
- Preserve the existing app behavior unless the task requires a UI or API fix.
- Validate with the smallest relevant test or script after changes.
