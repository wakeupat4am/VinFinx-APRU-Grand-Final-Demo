# Reproducing the recording experience

## Release contract

Priority order: shared UI and visual assets → user journey and session state →
backend integration → unchanged model artifacts. No mock model replaces a failed
real model in the recording app.

| Layer | Pinned or controlled | Deliberate variation |
| --- | --- | --- |
| Source | `demo-v1.1.0` tag; one UI implementation for all customers | Subsequent `main` commits |
| Typography | Local Nunito variable TTF and OFL license, source commit recorded | OS rasterization, native select controls and emoji |
| Assets | Mascot, partner logo and Leaflet shipped in Git | OpenStreetMap tiles need a network connection |
| Browser | Playwright 1.64.1 in package-lock, matching Chromium/WebKit | The user's manually chosen browser may render differently |
| Opening shot | Launcher: 1440×1000, en-US, Asia/Ho_Chi_Minh, light appearance, clean storage | OS window chrome and screen resolution |
| Customer UI | Same goal cards, guided steps, responsive styles and accessibility controls | Customer-specific numbers, evidence and saved progress |
| Data | Same synthetic profile inputs and property fixture; new state per take | Secure passwords, UUIDs, timestamps and payslip month |
| AVM | Four unchanged artifact hashes in assets.lock.json; actual CPU inference | Runtime/latency and tiny floating-point differences by platform |
| AI | UI tests force Qwen unavailable; deterministic evidence rendering | Optional live Qwen depends on private service availability |
| Reports | One renderer for preview and consented export | Evidence values, timestamps, browser print layout |

## Recording without session collisions

`npm run record` reads the selected state's local credentials and signs in normally
in three isolated Chromium contexts. It does not add a role-switch endpoint,
embed passwords in a URL, persist auth snapshots, or weaken access checks.
Each role gets a separate browser window; cookies and local/session storage cannot
cross between contexts. All contexts are closed when the launcher exits.

The launcher reloads all three after signing in and checks the actual `/api/me`
identity. `--check` performs that validation headlessly and exits.

The contexts always start clean. Browser progress is intentionally discarded when
those windows close; the selected SQLite state retains profiles and review actions.
For a fresh pending-review take, initialize a new `.demo-state-*` directory rather
than deleting or editing the previous database.

## Automated evidence

`demo.py qa` creates a temporary state and a loopback server for each selected
browser, uses real model inference, executes the browser script, closes the server
even after a failure, then removes that temporary state. The operator's existing
recording state is not read or changed. Generated screenshots and recordings stay
in ignored `qa-results/`; do not commit generated data or credentials.

The browser suite covers:

- Eight steps with actual valuation preview/save, PDF submission, score, scenario,
  contextual chat fallback and consented HTML export.
- Back/resume/reload, Guided/Standard/Explore, draft retention, blocked storage,
  invalid input, delayed inference and a deliberate 503 failure case.
- Ten viewport sizes (320–1440px), portrait/landscape/short phone bounds, chat,
  larger text, dark mode, reduced motion and simulated keyboard viewport shrinkage.
- Font download/load, English page/copy assertions, phone-bound content and no gap
  below navigation. Screenshots are available for human inspection.
- All six customers have identical goal/navigation labels and card dimensions
  in the same fresh browser configuration; their actual records remain distinct.
- Customer document pending → Authenticator approval → updated Customer/Advisor
  view and report provenance; Advisor cannot approve evidence.
- Three isolated role sessions remain distinct after reload.

These are functional/layout assertions and screenshots, not a claim of universal
pixel equality or a complete WCAG audit. Playwright WebKit is not physical-device
iOS Safari. Verify final recording on the actual screen, browser zoom and audio
setup that will be used on stage.

## Updating dependencies

Do not use an unlocked `npm install playwright@latest` for recording. Run `npm ci`
from this release, install the matching browser builds, and repeat browser QA after
any font, CSS, viewport, dependency or source change. Keep the model lock unchanged
unless a separately validated model release is intentionally adopted.
