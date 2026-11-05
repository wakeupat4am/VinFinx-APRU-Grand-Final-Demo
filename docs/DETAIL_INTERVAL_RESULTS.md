# Detail-aware ranges — measured results and recording guide

**6 November 2026 · Research option, not a new production appraisal model.**

The original interval used one constant log half-width regardless of omitted
fields. The new `detail_aware` method retains the exact LightGBM point prediction
and SHAP values, but uses a separate, hash-checked structural-missingness interval
policy. The original LightGBM and hierarchy options remain available and unchanged.

## Held-out evidence

- **171 calibration records**, **429 separate test records**, disjoint original
  Phase 1 listing groups. No model refit and no test-target-driven case selection.
- Same 429 test properties at every detail level; targets are historical **asking
  prices**, not completed sale prices. This is not the pooled Phase 1–3 benchmark.
- Complete structural-record cohort in supported Hanoi districts. Historical
  location keys are broader than the app's picker, and many records lack precise
  ward/street information. This is not street-specific validation.
- All **32 patterns** of five optional structural fields were calibrated. A
  conservative superset envelope only widens less-detailed intervals. Within
  scope, relative/log width cannot increase solely from adding valid fields;
  absolute VND width can increase when the price estimate moves.

| Available structural details | Test MedAPE | Test interval coverage | Median VND width |
| --- | ---: | ---: | ---: |
| None | 30.37% | 94.64% | 25.13 billion |
| Floors | 29.35% | 91.38% | 21.93 billion |
| Floors + frontage | 28.72% | 89.98% | 20.78 billion |
| Floors + frontage + road width | 26.94% | 90.44% | 17.52 billion |
| All five, including bedrooms/bathrooms | 23.65% | 90.44% | 17.02 billion |

The final MedAPE is **6.72 percentage points lower**, about **22.1% relative error
reduction**. This is a cohort result, not a promise of 22.1% better accuracy for
any new house. Nominal 90% is not 90% calibrated certainty for an individual home.
Minimum observed coverage across the 32 masks was **85.55%**.

The policy applies only within calibration ranges: area 23–530 m², floors 1–11,
frontage 2.4–53 m, road width 1–60 m, bedrooms/bathrooms 1–30 when supplied.
Outside scope, unknown geography or extra uncalibrated features trigger an
explicit baseline-or-wider fallback. In the complete test stage, 413/429 records
used the research policy and 16 used that fallback. Metrics include those fallbacks.
A measured policy can leave the interval equally wide after an additional field;
frontage → road is an example in relative-width terms.

The original seven-field experiment was not viable: only two calibration records
had both precise geography and all structural fields. We did not lower the minimum
sample-size gate or fabricate address-based improvement. The research scope was
revised before looking at outcome metrics; see [protocol](DETAIL_INTERVAL_PROTOCOL.md).

## Thirty-second live demonstration

1. Sign in as a Customer, choose the property goal, then open **See how more details
   help · Live example** on the property-input screen.
2. Click **1. Start with basic details**.
3. Click **2. Add building and access**.
4. Click **3. Add room details**.

Each click calls the real `/api/inference` endpoint. No displayed price is a canned
response. The clearly labelled synthetic example was already used in the demo:
52.3 m² on Street Thái Hà, Ward Quang Trung, District Đống Đa. It was not chosen
because of its error against a known test target. These previews do not save or
replace the customer's property.

| Live example | Approximate range | Absolute width |
| --- | --- | --- |
| Address + area | 3.31–26.87 billion VND | 23.55 billion VND |
| Add 4 floors, 4 m frontage and 4 m road | 3.54–17.30 billion VND | 13.77 billion VND |
| Add 3 bedrooms and 3 bathrooms | 3.63–16.29 billion VND | 12.66 billion VND |

The example's absolute width reduces by about **46.2%**. Its final price is not
proven correct: the synthetic property has no verified transaction target.

Suggested narration:

> “With only basic information, the range is broad. As we add structural details,
> the model uses measured errors from similar missing-data patterns to refine the
> range. On our separate historical asking-price test, median error fell from
> 30.37% to 23.65%. This is an indicative research estimate, not a bank appraisal.”

## Enter your own details instead

In **Add optional details → Method**, choose **Detail-aware ranges (research)**.
Calculate, add a structural field and calculate again. Empty fields remain unknown;
invalid or out-of-scope values do not earn a tighter interval. Geography validation
is unchanged. Saving attaches the policy hash and status to the inference record;
the report includes this provenance. Do not change the default method's label to
make an old saved valuation look like the new research result.

## Reproduction and provenance

The original model ZIP is still selected by `assets.lock.json`. The supplementary
ZIP in Release `demo-v1.2.0` is selected by `detail-assets.lock.json` and contains
only the policy and aggregate benchmark JSON, never raw listing records. Setup
checks archive/member hashes and adds the policy hash to the model manifest.
Inference checks that the policy belongs to the exact frozen model and transform.

To re-run the experiment, an authorized engineer needs the original private Phase 1
feature parquet and the original group-baseline calibration/test split files:

```bash
.venv/bin/python scripts/benchmark_details.py \
  --features /private/path/phase1_full_features.parquet \
  --split-dir /private/path/group_baseline \
  --output .runtime/reproduced-detail-study
```

Those data are intentionally not included in Git or required for running inference.
The protocol, script, input hashes and aggregate results document the boundary;
without the private data, a recipient can reproduce inference and UI, but cannot
independently repeat the historical accuracy benchmark.

Methodological reference: [Zaffran et al., ICML 2023, Conformal Prediction with
Missing Values](https://proceedings.mlr.press/v202/zaffran23a.html). Our method is
empirical split calibration by structural mask, not an implementation of that
paper's full algorithm. We make no universal conditional-coverage claim.
