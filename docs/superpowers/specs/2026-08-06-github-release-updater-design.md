# GitHub Release Updater Design

## Goal

Use GitHub Releases as the trusted delivery channel for signed Tauri updates.
The application checks stable releases, lets the user explicitly install an
available update, and restarts after the installation completes.

## Scope

The first release supports automatic updates for:

- Windows x86_64.
- macOS Intel x86_64.
- macOS Apple Silicon aarch64.

Only GitHub Releases created from stable version tags such as `v1.2.0` are
offered to users. GitHub prereleases are excluded from the production update
channel.

## Architecture

### Release pipeline

The GitHub Actions release workflow builds one signed updater artifact per
supported target. It uploads the installers, updater artifacts, signature
files, and a single `latest.json` manifest to the stable GitHub Release.

The manifest includes `darwin-x86_64`, `darwin-aarch64`, and
`windows-x86_64` platform entries. Each entry supplies the artifact URL and
the signature content for that exact platform. Tauri's updater reads the
manifest from:

`https://github.com/longl1005/agent-skill-manager/releases/latest/download/latest.json`

All release tags and application version fields use valid, matching semantic
versions. A release workflow validation step rejects a mismatch before assets
are published.

### Signing and trust

Tauri Updater verifies each artifact before installing it. The application
contains only the Tauri updater public key. The signing private key and its
optional password are stored exclusively in GitHub Actions secrets named
`TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.

The updater private key is never committed, displayed in logs, or bundled with
the app. Losing this key prevents future updates for already-installed users,
so it must also be stored securely outside GitHub.

Tauri update signing verifies update authenticity; it does not replace macOS
code signing and notarization or Windows code signing. Improving first-install
Gatekeeper and SmartScreen behavior is outside this feature's scope.

### Application update flow

1. After application startup, the update service checks the stable endpoint
   once in the background.
2. The service compares the installed semantic version with the verified
   release manifest.
3. When a newer version is available, a top-level update dialog displays its
   version, publication date, and release notes.
4. Choosing **Later** closes the dialog for the current application session;
   it does not suppress future releases.
5. Choosing **Update now** downloads and installs the signed platform-specific
   update while the dialog reports progress.
6. After installation succeeds, the app relaunches automatically into the new
   version.

The Settings page includes a **Check for updates** action. It invokes the same
service: it reports that the app is current, renders the update dialog, or
shows a recoverable error.

### Components and responsibilities

- `updateService`: owns the Tauri updater API calls, version result mapping,
  download progress, installation, and relaunch.
- `useUpdateStore` or equivalent top-level state: exposes `idle`, `checking`,
  `available`, `downloading`, `installing`, `upToDate`, and `error` states;
  prevents duplicate checks and installs.
- `UpdateDialog`: renders available-version details, progress, error feedback,
  Later, and Update now controls. It does not call Tauri APIs itself.
- Settings update control: invokes a manual check and renders transient
  current-version or failure feedback.

## Error handling

- Startup checks are silent on network, GitHub, manifest, signature, download,
  or install failures, leaving the running application untouched.
- Manual checks present a localized, actionable error and permit retrying.
- An unavailable content length renders indeterminate download progress rather
  than an incorrect percentage.
- Failed verification or installation does not restart the application.
- Development builds continue to run when no updater endpoint or production
  signature is available.

## Testing and release verification

- Unit-test update state transitions and duplicate-action protection.
- Test the update dialog's Later, Update now, download-progress, error, and
  automatic-relaunch paths with the updater API mocked at the Tauri boundary.
- Test Chinese and English update copy.
- Add workflow validation that the release tag, `package.json`, and
  `tauri.conf.json` versions match.
- Confirm the generated `latest.json` contains the three required platform
  entries and their corresponding signature values before publishing.
- Perform one controlled end-to-end update from an older signed test build for
  each supported platform before the first public updater release.
