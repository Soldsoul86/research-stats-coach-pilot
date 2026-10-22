# Research Stats Coach — MA/MSc Psychology student pilot

**Status:** Local standalone teaching prototype (22 October 2026). Not commercially launched, validated by student users, or AI powered.

## First use

1. Open `standalone.html` directly in a modern browser. It is self-contained and does not need a server or login.
2. Click **Explore a sample analysis**, then **Calculate & explain**. The 72-row example is **synthetic**, not collected from humans.
3. For your own work, first **anonymize your data**, then import a CSV or paste tabular text.
4. Select quantitative columns for Pearson correlation, or one two-level group and a quantitative outcome for Welch's independent-samples t-test.
5. Review the assumptions, the APA-style paragraph, and five viva preparation questions. Export the Markdown report if useful.

You can also serve the source from this directory: `python -m http.server 8000` and open `http://localhost:8000`.

## Implemented

- Browser-local CSV/TSV parser with escaped quote, newline, missing value, size and malformed-row handling.
- Data type inference and explicit variable selection.
- Pearson product-moment correlation: r, t statistic, two-sided p, 95% Fisher-transformed CI, sample count and excluded rows.
- Two-independent-groups Welch t-test: group means and SD, mean difference, Welch degrees of freedom, two-sided p and 95% CI.
- Scatterplot/dot-plot, assumption review, reproducible result text, Markdown export, and five method-specific viva exercises.
- Transparent keyboard-free keyword method suggestion. **This is not an LLM or AI reasoning engine.**
- Synthetic 72-row psychology dataset clearly marked as synthetic.

## Not implemented

No SPSS .sav, .omv, XLSX, regression, nonparametric alternatives, ANOVA, paired tests, Cronbach's alpha, confirmatory normality tests, sampling validation, healthcare/clinical interpretation, authenticated users, analytics, feedback intake, payments, or hosting. No automatic correct-test guarantee. No claim that its current experience outperforms ChatGPT or jamovi.

## Privacy and safety

All imported data is handled within the browser. The site makes no application HTTP calls and has no telemetry. A public host may collect ordinary access logs; uploaded CSV content is not transmitted by the app. Do not input personally identifiable or sensitive research data.

A teaching tool cannot establish independence, random sampling, valid constructs, causal design, or appropriateness of a test merely by inspecting numeric columns. Its skewness checks are descriptive only. Students should verify analyses with a supervisor and full statistical suite before submitting research.

## Reproduce statistical checks

`node tests/run_tests.js` — 10 unit/integration-level checks.

`python tests/scipy_crosscheck.py` — 100 deterministic randomized numerical comparisons to SciPy (50 Pearson, 50 Welch). Requires SciPy and NumPy, only for verification; these libraries are **not** needed for the web app.

`python tests/browser_test.py` — optional interactive Chromium smoke test. Was not executable in the current authoring environment because navigation is blocked by the container's administrator policy; do not mark browser QA complete until it runs in an unrestricted test environment.

## Commercial experiment

**Target:** Indian MA/MSc Psychology students working on dissertations and survey projects.

**Hypothesis:** A student will find a question-first, interpretation-and-viva workflow useful enough to pay ₹199 per completed analysis/study after trying an accurate free demonstration, despite jamovi, JASP, SPSS, and general-purpose AI alternatives.

**Gate 1:** 20 genuine students independently try the product. At least 10 complete a sample calculation and 5 evaluate their own anonymized study data. Collect feedback on missing methods and correctness. These are proposed screening targets, not results.

**Gate 2:** Confirm willingness to pay with a clear ₹199 offer and a working, approved payment path; measure **completed payments**, not hypothetical interest. No payment feature is wired today. Set up opt-in, privacy-safe measurement before a public experiment.

**Gate 3:** If students are unwilling to pay or the feature merely duplicates jamovi + ChatGPT, change the offer or stop. Do not expand into a general SPSS clone.

## Files

- `index.html`, `styles.css`, `bundle.js`: deployable browser-only website. Bundled JavaScript combines the tested statistics engine, synthetic sample, and interface logic.
- `standalone.html`: same browser-local experience in one file.
- `fixtures/sample_psychology.csv`: synthetic demo data.
- The full original source and verification tests are retained in the downloadable pilot source archive; tests were rerun successfully on October 22, 2026.
- `NEXT_7_DAYS.md`: channel and revenue experiment.

## Version 0.2 — clearer research interpretation (22 October 2026)

Deployed at https://research-stats-coach-pilot.onrender.com/ . The original shared URL is unchanged.

- Adds a separate, plain-language conclusion which never treats p ≥ .05 as proof of no association or equivalence.
- Reports Pearson r² as a descriptive percentage of shared linear variation, alongside Pearson r.
- Reports small-sample corrected Hedges’ g (pooled standard deviation) for the two-group Welch test; warns about variance differences.
- Distinguishes descriptive CSV screens (missingness, skew, IQR flags, group sizes) from critical human checks (independence, linearity, study design, sampling, validity).
- Includes explanations, effect sizes, and limitation flags in exported reports and viva notes.
- Retains browser-local CSV processing, free access, and no third-party analytics or AI backend.

Validation performed locally: 15 JavaScript tests, 100 randomized comparisons to SciPy (including Hedges g), and browser smoke tests at 390px/1280px using an offline page-injection approach because local URL navigation is blocked by the test environment. These checks do not establish validity for real research, and normal public-site end-to-end QA remains outstanding.

**Academic caution:** The alpha .05 threshold and effect size interpretation labels are teaching examples, not automatic research decisions. Confirm suitable tests with a supervisor. Never submit synthetic example observations as real research.
