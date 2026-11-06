# Submission build — demo-v1.2.1

## What to present

VinFinx × Vietcombank is a local, synthetic-data prototype with Customer, Advisor
and Authenticator roles. It is not a live banking integration or loan approval system.

**Key model demonstration:** Property → **See how more details help**. Tap the three
steps: basic details, building/access, room details. Each calls actual CPU LightGBM
inference. The declared synthetic example narrows from about 3.31–26.87 to
3.63–16.29 billion VND (46.2% reduction in absolute width). It has no known true
transaction price, so do not claim it is proven accurate. For custom input select
**Add optional details → Method → Detail-aware ranges (research)**.

Measured on separate historical asking-price records: 171 calibration and 429 test,
MedAPE30.37% →23.65%, final observed coverage90.44%. More details can leave a range
unchanged or widen it; individual accuracy is not guaranteed. This is not pooled
Phase1–3 validation. [Protocol and results](DETAIL_INTERVAL_RESULTS.md).

## Working / limited / planned

| Feature | Submission status |
| --- | --- |
| Three independent role windows and eight-step mobile journey | Working |
| Real LightGBM + optional detail-aware uncertainty | Working research demo |
| Suggested chat question: one tap sends and hides suggestions | Working |
| Ask Finx numbers/statuses from current saved evidence | Working deterministic templates |
| Re-read evidence if profile changes during generation | Working and regression-tested |
| Self-hosted Qwen selection API and SSH integration | Included; current server authentication blocked; live generation unverified |
| Human approval of extracted sample income | Working; sample data only |
| Financial score, peers and borrowing scenarios | Demo rules / explicitly synthetic assumptions |
| Report preview, consent and provenance | Working |
| Live bank data, verified macro adjustment, real-time listings | Not included |

## Two-minute recording

- **0:00–0:15 Customer:** goal selection and short guided instructions.
- **0:15–0:45 Customer:** the three live detail-comparison clicks; explain that
  missing details mean broader uncertainty, and this is an indicative estimate.
- **0:45–1:05 Customer:** financial health and pending sample income evidence.
- **1:05–1:20 Customer:** tap a sample Ask Finx question; suggestions collapse and
  the answer appears. If the label says Limited assistance, call it evidence-based
  guidance rather than live Qwen. Show report preview/consent.
- **1:20–1:40 Advisor:** assigned profile and explainable report.
- **1:40–2:00 Authenticator:** sample evidence review and the human approval gate.

Run `npm run record -- --port 4187` against the running local app to open three
isolated real-login windows. Setup, fresh local account generation and offline
artifact inputs are described in the main README. No account passwords are in Git.

## After SSH is restored

Follow [Qwen operator guide](QWEN.md), keep Qwen bound to127.0.0.1, use an SSH tunnel,
and run `.venv/bin/python scripts/check_qwen.py`. Only claim live Qwen after a real
request passes JSON validation and the app displays its Qwen mode. Restore the
server's authorized key/account; do not expose the inference port publicly.
