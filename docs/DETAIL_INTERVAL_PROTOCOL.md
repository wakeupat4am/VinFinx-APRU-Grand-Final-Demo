# Detail-aware interval experiment — 6 November 2026

Protocol written before inspecting masked test predictions. This is a new,
explicit research interval policy around the frozen LightGBM point predictor.
It must not be described as guaranteed accuracy improvement for each property.

1. Reuse the original Phase 1 group-calibration and group-test IDs. Never fit on
   test outcomes or modify model weights. Verify disjoint IDs and groups.
2. Restrict to supported Hanoi districts and training-seen geography, with all
   seven optional UI details observed and valid. This complete-record cohort is
   a limitation, not a representative sample of all Vietnamese property.
3. Use the app's actual preprocessing: subtype supplied, unused width/length
   omitted, text flags false. Evaluate the same records under all 96 valid masks:
   district only / ward / ward+street, crossed with five optional numeric fields.
4. For each mask, calibrate the 90th-percentile absolute log error using the
   finite-sample rank ceil((n+1)*0.9). At least 100 calibration records are needed.
5. A conservative envelope sets each mask's half-width to the largest calibrated
   half-width among its supersets. This ONLY WIDENS earlier intervals; it never
   clips a later interval or hides a point-estimate change. Relative/log width
   cannot increase when adding valid details. Absolute VND width may increase if
   the point estimate moves. An extra field need not strictly narrow a range.
6. Freeze the policy, then report held-out MedAPE and coverage for the five
   predeclared demonstration masks and coverage across all masks. Report any
   adverse accuracy movement. Do not select a property because it happens to
   match its test target. Use the existing synthetic demo property for recording.
7. Release only as a research option if each predeclared stage has at least 85%
   empirical coverage and the final stage improves cohort MedAPE over the basic
   stage. Nominal 90% is not a per-property confidence guarantee. Otherwise keep
   the existing interval and document the failed experiment.
8. Inference must fall back explicitly for unseen geography, out-of-scope inputs,
   extra uncalibrated features, or unavailable/untrusted policy. Blank/invalid
   fields are never counted as evidence. Keep a global-interval lower bound
   when no matching calibration policy can be used.

Reference: Zaffran et al. (ICML 2023),
[Conformal Prediction with Missing Values](https://proceedings.mlr.press/v202/zaffran23a.html).
This experiment uses empirical mask-specific split calibration; it does not
implement or claim the paper's full missing-data-augmentation algorithm or
universal conditional coverage. Current data are asking prices, not sale prices.

## Eligibility clarification before any masked outcome evaluation

Intersecting all complete input records with the demo's small street picker left
only **2 calibration rows**, below the predeclared 100-row gate. No intervals or
test metrics were computed from that cohort. The research cohort therefore uses
training-seen historical ward/street keys within the supported Hanoi districts;
it is broader than the current UI picker. The HTTP address-hierarchy validation
remains unchanged. This broader cohort is not a street-specific validation of
every selectable address. The 100-row gate and all outcome gates remain unchanged.

## Revised scope: structural details only (before outcome evaluation)

The broad location match also had only 2 calibration rows with genuinely observed
ward AND street: most stored geography values are the literal `missing`, not SQL
nulls. Do not treat these as supplied evidence. No original seven-field policy
was fit or evaluated. The implementable research scope is now **five structural
fields** (floors, frontage, road width, bedrooms, bathrooms), all 32 masks.
Geography is held fixed at each record's actual available level across masks;
missing strings are converted to omitted inputs. The five declared stages become
basic → floors → frontage → road access → rooms. Adding an address alone receives
no new calibrated narrowing claim. This is a limitation of available data, not a
reason to fabricate confidence. All sample-size and outcome gates remain.
