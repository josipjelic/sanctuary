## Learned User Preferences

- Slack preview notifications should use direct `exp://u.expo.dev/<project-id>/group/<group-id>` style links for testers; QR-first messaging was explicitly not desired when a working `exp://` link is available on device.
- Often asks to push to `origin` after changes (alongside the repo rule that default agent work stops at local commits unless push is requested).
- When EAS Update links misbehave, treats the URL pattern as fine once confirmed and expects diagnosis to focus on the update (runtime, bundle, publish), not the link shape.

## Learned Workspace Facts

- `eas update` JSON output includes one entry per platform (e.g. iOS and Android) that share the same `group` id, plus fields like `runtimeVersion`, `manifestPermalink`, and `gitCommitHash`—useful for workflows and comparing publishes.
- Failed EAS builds are inspected with `pnpm exec eas build:list` and `pnpm exec eas build:view <BUILD_ID> --json` (includes `error` and short-lived signed URLs in `logFiles`); there is no separate `eas build:logs` command.
- Native build errors such as Swift interface mismatches on `expo-file-system` have occurred when an Expo module’s major version is far ahead of the installed Expo SDK; align packages with `pnpm exec expo install <package>`.
- EAS workflow Slack notify steps can fail with “Invalid input” / parameter validation depending on payload shape (blocks vs plain text); this project had to iterate to a valid Slack job configuration.
