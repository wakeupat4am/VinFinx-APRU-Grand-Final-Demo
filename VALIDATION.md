# Release validation — 6 November 2026

This repository was copied into a separate directory, given a fresh Python 3.12
virtual environment, installed from requirements and provisioned with a new
synthetic database. No owner database or passwords were copied.

## Completed checks

- Fresh setup with the exact asset ZIP: checksum validation, dependency installation,
  `pip check`, 10 unique generated accounts and six personal PDF/PNG samples.
- Standalone Waitress service at loopback 4187; `demo.py prepare` saved an actual
  Customer 01 LightGBM valuation and extracted the matching PDF into pending review.
- **22 JavaScript checks passed**: existing iPhone shell, guided navigation,
  account-scoped progress, theme, drafts, navigation races, loan arithmetic.
- **7 backend suites passed**: readiness and origin checks; real model parity and
  idempotency; 10 concurrent users; upload deduplication, mismatched employee rejection,
  matching-sample human approval and review race; verified backup/restore; geographic
  hierarchy validation; Qwen outage fallback and report consent/snapshot checks.
- Concurrency run: **182 requests, 64 real CPU AVM inferences, 16 expected access
  denials, zero unexpected failures**. Inference HTTP p50 958.02 ms, p95 970.96 ms;
  run duration 7.75 s. These are local measurements, not a guarantee on another PC.
- Packaging scan: source excludes model files, generated market catalog, state DB,
  uploads, password files and private keys. AVM artifacts/catalog are hash-checked
  assets of the private GitHub release. Qwen weights are not included.

The model version is `phase1-baseline-20261015` with inference adapter
`avm-inference/2.1`. Frozen model/transform/calibration digests are in
`assets.lock.json`. No financial model, scoring formula or OCR approval policy was
changed for packaging.

## Portability fixes versus the working source tree

The recording repository adds `setup_demo.py` and `demo.py` to remove workstation
path/setup dependencies. The existing negative OCR test now generates its own
mismatched synthetic payslip instead of relying on a PDF outside the repository.
The omitted macro-research integration is a clearly labelled static unavailable
page under `/research/`; it does not simulate a live pipeline.

## Limits

- Fresh environment validation was on macOS ARM with Python 3.12. Linux and Windows
  installation commands need validation on the recipient's machine.
- The current HTML/CSS/JS originated from the locally browser-checked iPhone frame
  and readability fixes. This packaging run did not repeat a full physical-device
  browser matrix or an older-adult usability study.
- PDF text extraction and approval were tested. Image OCR needs an installed local
  engine; PNG was generated but new-machine Tesseract accuracy is not claimed.
- Qwen GPU generation was **not** tested in this release run. Outage fallback was.
- No bank integration, live macro decisions, native iOS application, production
  deployment or official credit approval is included.

Repeat the README commands and manual three-role checklist before recording.
