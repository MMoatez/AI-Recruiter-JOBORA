# Supervised skill-matching experiment

This experiment genuinely updates the weights of `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`; it does not fine-tune Groq and does not use RAG.

## Data and labels

`skill_pairs.csv` contains small, explicitly synthetic recruitment examples written for this university experiment. No human-annotation study or external dataset is claimed. The examples may be used with this project under CC0-1.0. Each canonical family belongs to exactly one split.

- `equivalent`, label `1.0`: expressions denote the same employable skill, including aliases and French/English equivalents.
- `partial`, label `0.5`: useful conceptual or ecosystem overlap, but not interchangeable competence.
- `non_equivalent`, label `0.0`: distinct skills, including plausible hard negatives.

Annotators should judge skill identity, not general topical proximity. Framework versus language, platform versus tool, and product versus adjacent product are partial or non-equivalent unless the expressions are genuine aliases. Ambiguous examples should be excluded. The leakage check rejects a canonical family appearing in more than one split.

## Reproduce on Windows

From `backend`:

```powershell
.\.venv\Scripts\python.exe -m training_experiments.run_experiment --smoke
.\.venv\Scripts\python.exe -m training_experiments.run_experiment --epochs 1 --batch-size 8
```

The baseline remains active in production. To opt in after reviewing the report:

```text
AI_RECRUITER_USE_FINETUNED_EMBEDDINGS=true
AI_RECRUITER_FINETUNED_CHECKPOINT=./training_experiments/artifacts/model
```

Outputs are written below `artifacts/`: a separate model checkpoint, `metrics.json`, `predictions.csv`, and `report.md`. Thresholds are selected only on validation data. This tiny synthetic dataset is suitable for demonstrating a reproducible training method, not for claiming production generalization.

The confusion-matrix order is `non_equivalent`, `partial`, `equivalent`. The committed experiment report is the actual most recent run; it must not be interpreted as evidence of improvement. Deployment is justified only if held-out metrics and error analysis improve on a larger, independently reviewed dataset.

## V2 rigor experiment

The original dataset, checkpoint, and `artifacts/` results are preserved unchanged as legacy evidence. Its stronger post-hoc leakage audit found that the individual phrases `Java` and `JavaScript` occurred in both validation and test even though canonical family names were disjoint.

`skill_pairs_v2.csv` contains 80 new explicitly synthetic examples: 40 train, 20 validation, and 20 final test. See `ANNOTATION_GUIDELINES.md`. All four automated leakage categories are empty. The final-test families were not used by v1 and are evaluated only after validation selects a candidate.

Run the locked comparison once into a new output directory:

```powershell
.\.venv\Scripts\python.exe -m training_experiments.run_comparison
```

The runner refuses to overwrite `artifacts_v2`. It trains two learning-rate settings across two seeds, saves each checkpoint separately, compares candidates only on validation, selects the best setting by mean validation macro-F1, then evaluates the baseline and selected candidate once on the final test.

V2 selected the conservative `5e-6`, seed 13 checkpoint. Baseline and selected-model final-test results tied: exact F1 `0.9474` and three-class macro-F1 `0.4696`. Both obtained partial-class F1 `0.0`. The fine-tuned checkpoint therefore remains experimental and is not justified for deployment. Threshold analysis also remains uncertain: nine baseline validation threshold pairs were within `0.01` macro-F1 of the optimum, with partial thresholds spanning `0.30–0.525`.
