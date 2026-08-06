# GitHub Release Updater Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver signed, user-approved updates from stable GitHub Releases for Windows x86_64 and macOS x86_64/aarch64.

**Architecture:** The official Tauri Updater plugin verifies a static `latest.json` hosted by the latest GitHub Release. A small service owns all Tauri updater calls, a Zustand store owns application state, and a top-level dialog plus Settings control render the resulting states.

**Tech Stack:** Tauri 2, `tauri-plugin-updater`, `tauri-plugin-process`, React 18, Zustand, Vitest, GitHub Actions.

## Global Constraints

- Check only `https://github.com/longl1005/agent-skill-manager/releases/latest/download/latest.json`; prereleases are excluded.
- Build and publish `darwin-x86_64`, `darwin-aarch64`, and `windows-x86_64` signed updater artifacts.
- Put the signing private key only in `TAURI_SIGNING_PRIVATE_KEY` and the optional password only in `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` GitHub secrets.
- Keep startup errors silent; manual checks show localized retryable feedback.
- Never relaunch after a failed download, signature verification, or installation.

## Release Signing Prerequisite

Before Task 1, the repository owner generates an updater key pair with
`npm run tauri signer generate -- -w <secure-private-key-path>`, stores the
private key content and optional password as the two GitHub Actions secrets,
and provides the generated public key for `tauri.conf.json`. The public key is
safe to commit; the private key must remain outside the repository and GitHub
logs. This prerequisite needs repository-secret access and cannot be completed
by source-code changes alone.

---

### Task 1: Configure signed Tauri updater support

**Files:**
- Modify: `package.json`
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/tauri.conf.json`
- Modify: `src-tauri/capabilities/default.json`

**Interfaces:**
- Produces: the JavaScript `check()` updater API and `relaunch()` process API for the frontend.
- Consumes: the public key produced by the release-signing prerequisite; it is committed in `tauri.conf.json` and never treated as a secret.

- [ ] **Step 1: Add a configuration regression test**

```ts
it("points the signed updater at the stable GitHub Release manifest", () => {
  const config = JSON.parse(readFileSync("src-tauri/tauri.conf.json", "utf8"));
  expect(config.bundle.createUpdaterArtifacts).toBe(true);
  expect(config.plugins.updater.endpoints).toEqual([
    "https://github.com/longl1005/agent-skill-manager/releases/latest/download/latest.json",
  ]);
  expect(config.plugins.updater.pubkey).toMatch(/BEGIN PUBLIC KEY/);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- src-tauri/tauri.conf.test.ts`

Expected: FAIL because updater configuration and test do not exist.

- [ ] **Step 3: Add the official updater and process plugins**

```toml
# src-tauri/Cargo.toml
tauri-plugin-updater = "2"
tauri-plugin-process = "2"
```

```rust
// src-tauri/src/lib.rs builder setup
.plugin(tauri_plugin_updater::Builder::new().build())
.plugin(tauri_plugin_process::init())
```

Configure `bundle.createUpdaterArtifacts: true`, the stable GitHub endpoint,
and the generated public key in `tauri.conf.json`; grant the updater and
process relaunch permissions in the default capability.

- [ ] **Step 4: Run the configuration test and Tauri type/build check**

Run: `npm test -- src-tauri/tauri.conf.test.ts && npm run build && cargo check --manifest-path src-tauri/Cargo.toml`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/src/lib.rs src-tauri/tauri.conf.json src-tauri/capabilities/default.json src-tauri/tauri.conf.test.ts
git commit -m "feat: configure signed Tauri updater"
```

### Task 2: Implement testable updater service and state

**Files:**
- Create: `src/services/updateService.ts`
- Create: `src/services/updateService.test.ts`
- Create: `src/stores/updateStore.ts`
- Create: `src/stores/updateStore.test.ts`

**Interfaces:**
- Produces: `checkForUpdate()`, `downloadAndInstallUpdate()`, and a store state with `idle | checking | available | downloading | installing | upToDate | error`.
- Consumes: `check` from `@tauri-apps/plugin-updater` and `relaunch` from `@tauri-apps/plugin-process` behind injected adapter functions.

- [ ] **Step 1: Write the failing store tests**

```ts
it("keeps one available update when a second check starts", async () => {
  const check = vi.fn().mockResolvedValue({ version: "1.2.0", body: "Notes", date: "2026-08-06" });
  await useUpdateStore.getState().checkForUpdates({ check });
  await useUpdateStore.getState().checkForUpdates({ check });
  expect(check).toHaveBeenCalledTimes(1);
  expect(useUpdateStore.getState().status).toBe("available");
});

it("does not relaunch when installation rejects", async () => {
  const relaunch = vi.fn();
  await useUpdateStore.getState().installUpdate({ downloadAndInstall: vi.fn().mockRejectedValue(new Error("offline")), relaunch });
  expect(relaunch).not.toHaveBeenCalled();
  expect(useUpdateStore.getState().status).toBe("error");
});
```

- [ ] **Step 2: Run the tests to verify failure**

Run: `npm test -- src/services/updateService.test.ts src/stores/updateStore.test.ts`

Expected: FAIL because the service and store do not exist.

- [ ] **Step 3: Implement the minimal service and store**

Expose normalized `UpdateInfo { version, notes, date }`, use downloaded bytes
and optional content length to calculate progress, lock duplicate check/install
requests, and distinguish silent startup failures from manual-check errors.

- [ ] **Step 4: Run the updater unit tests**

Run: `npm test -- src/services/updateService.test.ts src/stores/updateStore.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/updateService.ts src/services/updateService.test.ts src/stores/updateStore.ts src/stores/updateStore.test.ts
git commit -m "feat: add update service and state"
```

### Task 3: Add localized update dialog, startup check, and Settings control

**Files:**
- Create: `src/components/UpdateDialog.tsx`
- Create: `src/components/UpdateDialog.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/routes/Settings.tsx`
- Modify: `src/routes/Settings.test.tsx`
- Modify: `src/locales/dict.ts`
- Modify: `src/styles/global.css`

**Interfaces:**
- Consumes: `useUpdateStore` state/actions and localized `update.*` copy.
- Produces: a session-dismissable prompt, download state, manual-check button, and user-visible manual outcome.

- [ ] **Step 1: Write the failing user-facing tests**

```tsx
it("dismisses the available update for this session", () => {
  useUpdateStore.setState({ status: "available", update: { version: "1.2.0", notes: "Fixes", date: "2026-08-06" } });
  render(<UpdateDialog />);
  fireEvent.click(screen.getByRole("button", { name: "Later" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("checks for updates from Settings", () => {
  render(<Settings />);
  fireEvent.click(screen.getByRole("button", { name: /Check for updates/i }));
  expect(useUpdateStore.getState().checkForUpdates).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the component and route tests to verify failure**

Run: `npm test -- src/components/UpdateDialog.test.tsx src/routes/Settings.test.tsx`

Expected: FAIL because neither the dialog nor the Settings update control exists.

- [ ] **Step 3: Implement the minimum UI integration**

Mount `UpdateDialog` once in `App`, start a silent check after existing
hydration/scanning begins, and add a Settings card with a manual action. Render
version, date, notes, determinate or indeterminate progress, later/update
actions, and localized current/error status. Wire Update now to installation
and automatic relaunch only after success.

- [ ] **Step 4: Run the UI tests**

Run: `npm test -- src/components/UpdateDialog.test.tsx src/routes/Settings.test.tsx`

Expected: PASS, including Chinese and English copy checks.

- [ ] **Step 5: Commit**

```bash
git add src/components/UpdateDialog.tsx src/components/UpdateDialog.test.tsx src/App.tsx src/routes/Settings.tsx src/routes/Settings.test.tsx src/locales/dict.ts src/styles/global.css
git commit -m "feat: add update prompt and settings check"
```

### Task 4: Publish signed multi-architecture updater releases

**Files:**
- Modify: `.github/workflows/release.yml`
- Create: `scripts/create-release-manifest.mjs`
- Create: `scripts/create-release-manifest.test.ts`
- Create: `scripts/validate-release-version.mjs`

**Interfaces:**
- Consumes: stable `v*` tags, synchronized application versions, updater signing secrets, and GitHub release permissions.
- Produces: one GitHub Release containing installers, `.sig` files, updater artifacts, and `latest.json` entries for the three supported targets.

- [ ] **Step 1: Write the failing workflow contract test**

```ts
it("creates a complete stable manifest for all supported update targets", async () => {
  const manifest = await createReleaseManifest({
    version: "1.2.0",
    notes: "Fixes",
    artifacts: [
      { target: "darwin-x86_64", url: "https://example.test/mac-intel.tar.gz", signature: "mac-intel-signature" },
      { target: "darwin-aarch64", url: "https://example.test/mac-arm.tar.gz", signature: "mac-arm-signature" },
      { target: "windows-x86_64", url: "https://example.test/windows-setup.exe", signature: "windows-signature" },
    ],
  });

  expect(manifest.platforms).toEqual({
    "darwin-x86_64": { url: "https://example.test/mac-intel.tar.gz", signature: "mac-intel-signature" },
    "darwin-aarch64": { url: "https://example.test/mac-arm.tar.gz", signature: "mac-arm-signature" },
    "windows-x86_64": { url: "https://example.test/windows-setup.exe", signature: "windows-signature" },
  });
});
```

- [ ] **Step 2: Run it to verify failure**

Run: `npm test -- scripts/create-release-manifest.test.ts`

Expected: FAIL because the manifest generator does not exist.

- [ ] **Step 3: Replace the release workflow**

Implement `createReleaseManifest()` so it rejects a missing target, empty URL,
or empty signature. Implement `validate-release-version.mjs` so it rejects a
tag that differs from the versions in `package.json` and `tauri.conf.json`.
Replace the release workflow with a stable-tag matrix that builds both macOS
Rust targets and Windows x86_64 with signer secrets available. Collect each
updater artifact and signature, generate one complete `latest.json`, and
publish it only on a non-prerelease GitHub Release.

- [ ] **Step 4: Run workflow test and full verification**

Run: `npm test && npm run build && cargo check --manifest-path src-tauri/Cargo.toml`

Expected: PASS. Before the first public release, run a controlled upgrade from
an older signed build on Windows x86_64, macOS x86_64, and macOS aarch64.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/release.yml scripts/create-release-manifest.mjs scripts/create-release-manifest.test.ts scripts/validate-release-version.mjs
git commit -m "ci: publish signed updater releases"
```
