# Release validation — 6 November 2026

## English recording release (v1.1)

The shared app remains an actual local application, not a clickable screenshot.
The release translates the root documentation and remaining scenario error, uses
English administrative labels while retaining canonical Vietnamese location keys,
and bundles the licensed Nunito font so system font availability cannot change
text metrics. Existing financial engines and artifact hashes are unchanged.

The release adds pinned Playwright tooling, a three-context real-login launcher
and a portable QA runner that provisions isolated synthetic state and stops its
own loopback server. The Python dependency file now pins the validated transitive
runtime dependencies as well as the direct packages.

### Completed checks

- A **clean Git clone of implementation commit `35ede32`** ran
  `setup_demo.py --with-browser` with no copied virtual environment, database,
  credentials or runtime assets. It downloaded the original GitHub Release ZIP,
  verified hashes, installed the locked Python/npm dependencies, and created fresh
  accounts. From that clone, all 22 JS checks and the complete Chromium/WebKit QA
  runs passed, including customer parity, human approval and isolated role windows.
- **22 JavaScript checks passed:** state/navigation, theme, draft isolation,
  iPhone shell bounds and deterministic scenario arithmetic.
- **7 backend suites passed:** readiness/origin checks, actual model parity and
  idempotency, role isolation, 10 concurrent users, geographic hierarchy, upload
  deduplication, employee mismatch rejection, approval races, backup/restore,
  Qwen outage fallback and report consent/snapshot checks.
- Concurrency: **182 requests, 64 actual CPU inferences, 16 expected access denials,
  zero unexpected failures**. Inference HTTP p50 929.41 ms, p95 947.62 ms; test
  duration 7.53 seconds on this Mac. This is not a performance guarantee elsewhere.
- Chromium **156.0.8078.4** (Playwright build 1248) and WebKit **27.2** (build 2370),
  with Playwright **1.64.1**, completed the real eight-step customer walkthrough:
  preview/save valuation, pending PDF evidence, score, deterministic scenario,
  Ask Finx fallback and consented HTML download.
- Both browser engines passed 10 viewport sizes from **320×568 to 1440×900**, six
  phone-fit conditions including landscape and a short viewport, dark/larger text,
  reduced motion, draft/resume, invalid inputs, delayed and failed model requests,
  keyboard-height simulation, chat controls and role layouts.
- The bundled font loaded in both engines. Representative report/mobile and
  desktop advisor screenshots were visually inspected.
- Both engines verified identical opening labels and card dimensions for all six
  Customers, while preserving separate profiles. The real cross-role handoff
  passed: pending evidence → human approval → updated Customer/Advisor score and
  report provenance; Advisor approval was correctly denied.
- The launcher signed in all three roles independently and retained the correct
  identity after reloading each window.

Generated screenshots, video and measurements are available after running
`demo.py qa` under ignored `qa-results/`. Repeat the tests on the recording machine.
This is assertion-based layout/flow QA, not cross-OS pixel-perfect certification.

### Unchanged model contract

The model version remains `phase1-baseline-20261015` with inference adapter
`avm-inference/2.1`. Model/transform/calibration digests are in `assets.lock.json`.
The source release intentionally reuses the exact original **demo-v1** asset ZIP.
No financial formula, benchmark result or OCR verification policy changed.

### Known limits

- Validation host: macOS ARM, Python 3.12.14, Node.js 24.7.0. Linux/Windows install
  instructions are supplied, but those OS installations have not been certified.
- Browser automation uses Playwright WebKit, not a physical iPhone with Safari.
  Keyboard handling is simulated; device, VoiceOver and older-adult testing remain.
- Local font metrics are consistent, but native controls, emoji, rasterization and
  browser PDF-print pagination can differ across platforms.
- PDF extraction and human approval use synthetic samples. Image OCR needs the
  installed local engine; no new-machine Tesseract accuracy claim is made.
- Qwen GPU generation was not measured in this release. The deterministic outage
  fallback is tested and labelled. Qwen requires a separately authorized service.
- No bank APIs, live macro decisions, live agent listings, native iOS application,
  official credit approval or public application hosting is included.

## Initial standalone release (v1)

The original release was installed into a fresh Python 3.12 environment, downloaded
its hash-checked model ZIP from GitHub, and provisioned ten unique accounts and six
PDF/PNG samples. Seven backend suites and 22 JavaScript checks passed. This v1.1
release adds repeatable browser QA and recording setup instead of relying solely
on the original workstation's earlier manual UI checks.
