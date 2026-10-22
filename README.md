# Research Stats Coach — MA/MSc Psychology student pilot

**Status:** Free, deployed teaching pilot (version 0.2, 22 October 2026). Not commercially validated by student users or AI powered. **Live:** https://research-stats-coach-pilot.onrender.com/ .

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
- Scatterplot/dot-plot, descriptive assumption screens plus human-review checklist, readable result interpretation, Pearson r² and Hedges g, reproducible result text, Markdown export, and five method-specific viva exercises.
- Transparent keyboard-free keyword method suggestion. **This is not an LLM or AI reasoning engine.**
- Synthetic 72-row psychology dataset clearly marked as synthetic.

## Not implemented

No SPSS .sav, .omv, XLSX, regression, nonparametric alternatives, ANOVA, paired tests, Cronbach's alpha, confirmatory normality tests, sampling validation, healthcare/clinical interpretation, authenticated users, analytics, built-in feedback intake, or payments. No automatic correct-test guarantee. No claim that its current experience outperforms ChatGPT or jamovi.

## Privacy and safety

All imported data is handled within the browser. The site makes no application HTTP calls and has no telemetry. A public host may collect ordinary access logs; uploaded CSV content is not transmitted by the app. Do not input personally identifiable or sensitive research data.

A teaching tool cannot establish independence, random sampling, valid constructs, causal design, or appropriateness of a test merely by inspecting numeric columns. Its skewness checks are descriptive only. Students should verify analyses with a supervisor and full statistical suite before submitting research.

## Reproduce statistical checks

`node tests/run_tests.js` — 15 unit/integration-level checks, including effect sizes and conservative p-value language.

`python tests/scipy_crosscheck.py` — 100 deterministic randomized numerical comparisons to SciPy (50 Pearson including r², 50 Welch including Hedges g). Requires SciPy and NumPy, only for verification; these libraries are **not** needed for the web app.

`python tests/browser_inline_test.py` — browser interaction smoke tests in 390px and 1280px viewports via offline page injection. Direct local URL navigation remains blocked by the authoring environment; public URL end-to-end QA is still outstanding.

## Commercial experiment

**Target:** Indian MA/MSc Psychology students working on dissertations and survey projects.

**Hypothesis:** A student will find a question-first, interpretation-and-viva workflow useful enough to pay ₹199 per completed analysis/study after trying an accurate free demonstration, despite jamovi, JASP, SPSS, and general-purpose AI alternatives.

**Gate 1:** 20 genuine students independently try the product. At least 10 complete a sample calculation and 5 evaluate their own anonymized study data. Collect feedback on missing methods and correctness. These are proposed screening targets, not results.

**Gate 2:** Confirm willingness to pay with a clear ₹199 offer and a working, approved payment path; measure **completed payments**, not hypothetical interest. No payment feature is wired today. Set up opt-in, privacy-safe measurement before a public experiment.

**Gate 3:** If students are unwilling to pay or the feature merely duplicates jamovi + ChatGPT, change the offer or stop. Do not expand into a general SPSS clone.

## Files

- `index.html`, `styles.css`, `statistics.js`, `demo-data.js`, `app.js`, `bundle.js`: source and bundled assets for the deployed static website.
- `standalone.html`: same browser-local experience in one file.
- `fixtures/sample_psychology.csv`: synthetic demo data.
- `tests/run_tests.js`, `tests/scipy_oracle.json`, `tests/scipy_crosscheck.py`: independent numerical tests.
- `NEXT_7_DAYS.md`: channel and revenue experiment.

## 0.2 change log (22 October 2026)

- Plain-language conclusions distinguish statistical evidence from practical meaning, and do not equate non-significant with no effect.
- Pearson r² and exact small-sample corrected Hedges g are now calculated and explained.
- Assumption review explicitly separates descriptive screens, flagged observations and research-design checks requiring human judgment.
- APA paragraph, viva questions, and exported Markdown updated accordingly.
- Same public website URL; previous visitors can refresh to see the changes.