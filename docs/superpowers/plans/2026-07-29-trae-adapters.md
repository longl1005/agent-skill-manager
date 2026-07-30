# TRAE and TRAE CN Adapters Implementation Plan

**Goal:** Add independently managed TRAE and TRAE CN skills agents.

**Architecture:** Add `TraeAdapter` for `~/.trae/skills` and `TraeCnAdapter` for `~/.trae-cn/skills`, using the existing SKILL.md scan path. Register separate IDs in scanning, master-library linking, settings, and visual identity with existing assets.

**Constraints:** IDs are `trae` and `trae-cn`; no project-level scanning; reuse `trae.webp` and `trae-cn.webp`.

### Tasks

- [ ] Add and test independent backend root detection and scanning for both adapters.
- [ ] Register both IDs for scanning and master-library linking.
- [ ] Add settings, skill-library entries, official icon mappings, and tests.
- [ ] Run Rust tests, frontend tests, and production build.
