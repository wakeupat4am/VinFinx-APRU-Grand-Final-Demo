# VinFinx × Vietcombank — APRU Grand Final Demo

**An English, three-role demo you can clone, rehearse and record on your own computer.**

MyWealth helps a customer explore an indicative property value, understand their financial health and prepare for a conversation with an advisor. Finx guides the customer through eight small steps. The same application supports a normal web layout and an interactive iPhone-style preview.

This release prioritizes **reproducing the experience first**: bundled typography and mascot assets, one shared customer interface, fresh synthetic accounts, independent role windows, pinned browser tools and an automated mobile walkthrough. The existing AVM, financial scoring rules and human approval gate are retained.

> **Research demo, synthetic profiles.** Property inference uses actual CPU LightGBM artifacts trained on historical asking prices. The financial-health score is an illustrative rule-based score. Neither is a formal appraisal, official credit score, verified lending offer or bank approval. There is no live banking integration.

## 1. Recommended setup for recording

### Requirements

- **Python 3.12** with `venv`. Do not substitute a different Python version for the serialized model.
- **Git and GitHub CLI (`gh`)**, authenticated to an account that can access the repository and its model Release.
- **Node.js 24** and npm for the one-command role launcher and browser QA. `.nvmrc` records the tested Node version. The Python web app itself does not need Node.
- macOS: `libomp` for LightGBM. Linux: `libgomp1` and the OS packages required by Playwright.
- Optional local image OCR: Tesseract, or Apple Vision on macOS. The supplied **text PDF** demonstration works without an image OCR engine.

On macOS with Homebrew:

```bash
brew install python@3.12 gh node@24 libomp tesseract
```

Use your installation's instructions to put Python and Node on `PATH`. Confirm `python3.12 --version`, `node --version` and `npm --version` before proceeding. On Ubuntu, install Python 3.12 with `venv`, Git, GitHub CLI, Node.js and `libgomp1` from your supported package sources; do not replace the system Python.

### Clone and install

```bash
gh auth login
gh repo clone wakeupat4am/VinFinx-APRU-Grand-Final-Demo
cd VinFinx-APRU-Grand-Final-Demo
python3.12 setup_demo.py --with-browser
```

The installer:

1. Downloads `vinfinx-demo-assets-v1.zip` from the immutable **demo-v1** Release named in `assets.lock.json`.
2. Verifies the ZIP and every allowed member against SHA-256 hashes before loading anything.
3. Creates `.venv`, installs the pinned Python dependencies, and runs `pip check`.
4. Creates **10 new synthetic accounts** and six individual, watermarked PDF/PNG payslips.
5. With `--with-browser`, installs npm dependencies from `package-lock.json` and the matching Chromium/WebKit builds.

No developer database, old passwords, raw property datasets or private server credentials are needed. Internet is needed for installation. Once installed, the core experience runs locally; map tiles and optional Qwen have separate dependencies.

**Repeatable release:** use the `demo-v1.1.0` tag to reproduce this source version. The tag's model lock intentionally still references `demo-v1`: the model artifacts have not changed. Use `main` for subsequent updates.

If you received the exact asset ZIP separately:

```bash
python3.12 setup_demo.py --assets /absolute/path/vinfinx-demo-assets-v1.zip --with-browser
```

The supplied ZIP must match `assets.lock.json`. Do not bypass checksum checks. Only load the trusted project transformer: pickle/joblib files can execute code.

### Start the application

In terminal 1:

```bash
.venv/bin/python demo.py serve
```

Wait for `pilot listening`. Keep this terminal open.

| Interface | Local address |
| --- | --- |
| Web app | http://127.0.0.1:4176/ |
| iPhone-style preview | http://127.0.0.1:4176/?demo=ios |

`127.0.0.1` means the computer running the server. It is not a public domain or a link someone can open on a different computer. The service binds only to loopback. The iPhone view is an interactive **web preview**, not a native iOS app or Xcode simulator.

In terminal 2, from the same repository:

```bash
.venv/bin/python demo.py prepare
npm run record
```

`prepare` uses normal authenticated APIs to save one actual Customer 01 valuation and submit their synthetic PDF for review. It does **not approve income**, overwrite an existing valuation or discard existing documents. Skip it if you want to demonstrate the complete empty-state entry flow instead.

`npm run record` opens **three independent Chromium windows**, logs each in through the real sign-in form, then reloads all three to verify session isolation:

1. Customer 01 — iPhone preview.
2. Advisor 01 — web workspace.
3. Authenticator 01 — web review queue.

Switch windows while recording; no logout/login is required. Each launch uses fresh browser storage with English locale, Light appearance and the same desktop viewport. Customer starts in Guided mode at step 1 with default text size. Database records persist. Keep the launcher terminal open; `Ctrl+C` closes its windows. Passwords are not printed by the launcher.

## 2. Accounts and role boundaries

For manual sign-in, print your installation's credentials:

```bash
.venv/bin/python demo.py accounts
```

| Role | Suggested account | Authorized functions |
| --- | --- | --- |
| Customer | `customer01@vinfinx.demo` | Own valuation, finances, documents, Ask Finx, loan scenarios and consented report export |
| Advisor | `advisor01@vinfinx.demo` | Assigned Customer 01–03, profile explanations, consultation and read-only document review |
| Authenticator / Verifier | `authenticator01@vinfinx.demo` | Evidence and valuation review, approve/reject actions and audit log |

There are **6 Customers, 2 Advisors and 2 Authenticators**. Advisor 02 is assigned Customer 04–06. The team's term **Auditor** refers to the audit/review function of Authenticator; it is not a fourth role. Advisor is the consultation role. UI text sometimes calls Authenticator **Verifier** for clarity.

All six Customers use the same HTML, CSS, components and journey logic. Their financial values, uploaded documents, verification status and progress remain separate. Identical UI does not mean shared customer data or identical scores.

Passwords are randomly generated in `.demo-state/pilot_accounts.json`, which is ignored by Git. Do not record this file or the output of `accounts`. Passwords from another clone or an old chat will not work. Sessions expire after eight hours.

### Manual browser use

Use three separate browser profiles or different browsers. Ordinary tabs on the same origin share cookies; different localhost ports do not isolate those cookies. Do not rely on multiple Incognito windows sharing one profile. The included launcher is the tested way to open three independent sessions without changing access control.

Without browser tooling, omit `--with-browser`, start the Python server and sign in manually. You still get the same app assets, UI and backend.

## 3. Customer walkthrough and navigation

| Step | Customer action | Expected result |
| --- | --- | --- |
| 1. Goal | Choose property, financial health or borrowing | A short explanation and one clear next action |
| 2. Property | Select district → ward → street; enter area and other known details | Dependent locations stay within the selected parent; unknown details may be omitted |
| 3. Valuation | Get a range, expand explanations; save when appropriate | Model estimate, interval, drivers, provenance and limitations |
| 4. Income evidence | Use the synthetic text PDF or upload an allowed sample | Extraction is labelled pending; income is not automatically verified |
| 5. Financial health | Review score, monthly surplus and components | Current rule-based score using stored evidence and its verification state |
| 6. Loan scenario | Enter a hypothetical amount and inspect rate sensitivity | Deterministic payments and assumptions, not an offer or approval |
| 7. Ask Finx | Ask a suggested or typed question | Context-aware explanation from authorized evidence, with the actual assistance mode |
| 8. Advisor and report | Preview the report, review the contents, explicitly consent to export | Downloadable HTML with the recorded evidence and provenance |

Property-goal users must obtain a successful estimate before advancing from property input. Other goals can skip that step. A preview is not a saved customer record: use the save action when the estimate must appear in the advisor workspace, Ask Finx or the report.

Back, permitted Skip, Pause, resume and direct navigation remain available. **Guided, Standard and Explore** share the same features and backend. Changing a property input invalidates its completed-input state until recalculated. Guided progress is stored per customer in that browser; profile data is stored in SQLite. Browser drafts are not durable backups.

Explanations have three levels: the immediate plain-language takeaway, expandable numeric/practical detail, and assumptions/model/source information. Finx, large controls, bold key phrases, Larger text, light/dark/system appearance and reduced-motion behavior are preserved.

## 4. Repeat the same recording start

The launcher starts with empty cookies and browser storage on every invocation, so old journey progress and theme choices cannot change the opening shot. It does **not reset database records**.

For a fully fresh recording take, stop your current server, choose a new state directory and use it consistently:

```bash
.venv/bin/python demo.py init --state .demo-state-take2
.venv/bin/python demo.py serve --state .demo-state-take2
# In another terminal:
.venv/bin/python demo.py prepare --state .demo-state-take2
npm run record -- --state .demo-state-take2
```

Existing state is never silently reset. Setup preserves existing accounts. `init` refuses incomplete state instead of overwriting it. Reusing a take after approval correctly shows **Verified**, not Pending. Choose a new take to record Pending again.

The synthetic financial inputs and matching property fixture are consistent across fresh installations. Passwords, document IDs, audit timestamps, report timestamps and current payslip month intentionally differ. Native browser controls, emoji and text rasterization can vary by OS. We do not promise byte-identical screenshots across different operating systems.

For exact comparison, use the same source tag, locked dependencies, browser build, viewport, locale, timezone and fresh state. See [reproducibility contract](docs/REPRODUCIBILITY.md).

## 5. Suggested two-minute recording

| Time | Role | Show |
| --- | --- | --- |
| 00:00–00:10 | Customer | Three goals, simple instructions and Finx as a persistent guide |
| 00:10–00:30 | Customer | Property details and indicative asking-price range; expand one explanation |
| 00:30–00:45 | Customer | Synthetic payslip extraction and **Pending review** |
| 00:45–01:00 | Customer | Financial score breakdown, monthly surplus and a hypothetical repayment |
| 01:00–01:20 | Customer | Ask Finx, then preview the report; export only after consent |
| 01:20–01:40 | Advisor | Switch window; open the assigned profile and show the same evidence |
| 01:40–02:00 | Authenticator | Switch window; inspect the payslip, verify it and show the audit trail |

Rehearse before recording. `prepare` supplies saved evidence but does not mark the browser's property-input task complete: calculate once if that step asks you to. Avoid scrolling through every technical detail in the two-minute recording.

`Verify sample income` really changes the synthetic profile. Refresh the other windows to see the update. A score change caused by new evidence is not proof that the person's actual financial health improved.

Export is HTML. Open the downloaded report and use the browser's **Print → Save as PDF** if you need PDF. Print layout depends on the browser's print settings.

## 6. Verify UI/UX before model benchmarking

After `setup_demo.py --with-browser`:

```bash
npm test
.venv/bin/python demo.py qa
.venv/bin/python demo.py test
```

- `npm test`: fast UI state/navigation, themes, draft isolation and loan-calculation checks.
- `demo.py qa`: launches temporary loopback servers with **fresh synthetic state per browser**, exercises Chromium and WebKit, saves screenshots/measurements, then stops those servers. It never uses `.demo-state`.
- `demo.py test`: isolated backend/model tests for permissions, real inference, verification, consent, geographic hierarchy and concurrency.

Browser QA exercises the eight-step walkthrough, reload/resume, all experience modes, missing inputs, a delayed request, model failure, chat fallback, report consent/export, phone frame bounds, keyboard-height handling, larger text, dark mode and role layouts. It also verifies that the bundled font actually loaded and that the three-window launcher retains distinct users after reload.

QA intentionally disables Qwen to validate a repeatable outage fallback. It does not claim live Qwen generation. The deliberate delayed/503 requests are browser test cases; the ordinary app's successful AVM requests use the real model.

Screenshots, recordings and logs are written to ignored `qa-results/`. Failed checks exit nonzero. Inspect them before recording. A focused run is available:

```bash
.venv/bin/python demo.py qa --browsers chromium
```

On supported Linux hosts, Playwright may need OS libraries: run `npx playwright install --with-deps chromium webkit` with your normal administrator approval. Physical iPhone Safari, VoiceOver and older-adult usability still require device/user testing; WebKit automation is not a substitute.

## 7. Working, simulated and planned elements

| Area | What this release actually does |
| --- | --- |
| UI and navigation | Working shared English UI, local font/mascot/logo/Leaflet, responsive web/iPhone preview, three roles, saved drafts and progress |
| AVM | Actual CPU LightGBM prediction and native SHAP with frozen artifact hashes; historical Hanoi landed-house asking-price scope |
| Hierarchy option | Existing research residual calibration on LightGBM; not the newer pooled structural land/house/macro hierarchy |
| Financial health | Existing deterministic demo rules, stored evidence, component explanations and scoring version |
| Comparison group | **100 synthetic peer scores**, not a live bank customer cohort |
| Documents | Fresh watermarked samples; PDF text extraction; PNG OCR needs an installed local engine; only built-in samples accepted |
| Verification | Actual human approval gate; OCR pending never means verified income |
| Ask Finx | Deterministic explanations by default; optional private Qwen selects bounded evidence/actions; trusted code renders numbers and labels |
| Loans | Hypothetical fixed-payment scenarios and sensitivity, no live rates or eligibility claims |
| Reports | Consented HTML export with snapshot/evidence provenance; browser PDF printing available |
| Map | Historical street aggregates; OpenStreetMap tiles require internet; positions may be approximate district centers, not live agent listings |
| Macro research | Explicit unavailable-integration page; separate research API/corpus are not bundled and do not change customer decisions |
| Banking / native iOS | Planned integrations, not implemented banking APIs or an installable iOS app |

A **nominal 90% prediction interval is not 90% calibrated certainty**. Separate research on asking prices reported median APE **33.35%** and empirical coverage about **83.5%**; these are not newly measured guarantees for every input or artifact in this demo. This release does not alter the model, scoring formula, benchmark results or OCR approval policy.

## 8. Optional live Qwen

No GPU or VPN is needed for the base recording. Do not send customer documents or records to external LLM services.

If an authorized operator already runs Qwen3.5-9B on loopback port 8061, keep this SSH tunnel open:

```bash
ssh -N -o ExitOnForwardFailure=yes -o ServerAliveInterval=20 \
  -L 127.0.0.1:8061:127.0.0.1:8061 YOUR_AUTHORIZED_SSH_ALIAS
```

In the app terminal before starting the server:

```bash
export VINFINX_QWEN_URL=http://127.0.0.1:8061/vinfinx-api
export VINFINX_QWEN_ORIGIN=http://127.0.0.1:4176
.venv/bin/python demo.py serve
```

The operator must allow that origin. Never expose port 8061 publicly. Inspect **Check services**, then ask a real question and inspect the response mode. A healthy endpoint alone does not prove generation works. When Qwen is unavailable or its output fails validation, Finx explains stored evidence deterministically and labels the mode.

Qwen weights, SSH keys and GPU dependencies are not bundled. Operator instructions and the adapter contract are in [docs/QWEN.md](docs/QWEN.md). The original [AI engineering handoff](prototype/vinfinx/AI_ENGINEERING_HANDOFF.md) describes broader research work, not a promise that all of it ships here.

## 9. Windows and alternate ports

Windows commands (installation on Windows is not yet validated):

```powershell
py -3.12 setup_demo.py --with-browser
.venv\Scripts\python.exe demo.py serve
# Another terminal:
.venv\Scripts\python.exe demo.py prepare
npm run record
```

For PNG, install Tesseract and set `VINFINX_TESSERACT` to its executable. LightGBM may need the Microsoft Visual C++ runtime. Use the PDF flow if image OCR is unavailable, and call it **PDF text extraction**, not image OCR.

If port 4176 is occupied, choose the same alternate port in every command:

```bash
.venv/bin/python demo.py serve --port 4187
.venv/bin/python demo.py prepare --port 4187
npm run record -- --port 4187
```

Do not stop an unknown service to free a port. Update the Qwen allowed origin when changing ports.

## 10. Troubleshooting

| Symptom | Action |
| --- | --- |
| Repository or Release 404 | Confirm repository visibility/access. For a private repo, accept the collaborator invitation and run `gh auth status`. |
| Python/transformer error | Use Python 3.12 and the pinned requirements; do not independently upgrade scikit-learn. |
| Missing model or hash mismatch | Obtain the exact locked Release ZIP and rerun setup. Do not suppress hash checks. |
| Browser executable missing | Run `npm ci --ignore-scripts`, then `npm run browsers`. |
| Browser fails on Linux | Install the matching Playwright OS dependencies; inspect the launch error. |
| UI differs from the video | Use the same tag and `npm run record`, check viewport and text size, and confirm the local Nunito font loaded. |
| An old journey opens | The browser has saved progress. Launch fresh contexts with `npm run record`; this preserves database records. |
| Review is already approved | Use a new `--state` take; approvals are not silently undone. |
| Three tabs switch to the same role | Cookies are shared. Use the three-context launcher or separate browser profiles. |
| PNG extraction fails | Install/check Tesseract or use the text PDF sample. |
| Qwen offline | The app still works with labelled rule-based assistance. Check the authorized tunnel/service for live Qwen. |
| Chat/report lacks a previewed estimate | Save the estimate first; a preview is not stored evidence. |
| Map tiles do not load | Check internet access; historical street list and financial functions are still local. |
| Service exits when terminal closes | Keep the server terminal open during recording; use `Ctrl+C` to stop deliberately. |

## 11. Files and data boundaries

```text
README.md                         Setup, recording and troubleshooting
VALIDATION.md                     Observed release checks and remaining limits
docs/REPRODUCIBILITY.md            Version/state/UI reproducibility contract
setup_demo.py                     Hash-check assets, install, provision
demo.py                          init / accounts / serve / prepare / qa / test
requirements.txt                  Pinned app runtime (no GPU stack)
package.json + package-lock.json  Locked browser automation tools
assets.lock.json                  Unchanged model Release and SHA-256 hashes
scripts/                          Portable QA and isolated-role launcher
prototype/vinfinx/local_app/       Shared UI, backend and engine adapters
.runtime/                         Downloaded model/catalog; ignored
.demo-state*/                     Credentials, DB, samples and uploads; ignored
qa-results/                       Generated screenshots/logs/video; ignored
```

Model files and the generated market catalog are Release assets, not Git history. Generated datasets, customer documents, passwords, keys and databases are excluded from commits. The model files are unchanged from the first standalone demo release.

Bundled Nunito is licensed under SIL OFL 1.1; its license and pinned source are under `assets/fonts/`. Leaflet's license is under `assets/vendor/`. Preserve OpenStreetMap attribution. Partner branding is included under the authorization supplied by the project owner; it does not imply official bank approval. Repository visibility does not grant a new source-code or bank-brand license.

See [VALIDATION.md](VALIDATION.md) for actual test results and platform limits.
