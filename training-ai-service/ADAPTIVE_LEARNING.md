# Adaptive learning with Bayesian Knowledge Tracing

This module implements BKT independently of Groq. Version `assumed-v1` uses assumed, not fitted, parameters: P(L0)=0.25, P(T)=0.12, P(G)=0.20 and P(S)=0.10.

For a correct observation, `P(L|correct) = P(L)(1-P(S)) / [P(L)(1-P(S)) + (1-P(L))P(G)]`. For an incorrect observation, `P(L|incorrect) = P(L)P(S) / [P(L)P(S) + (1-P(L))(1-P(G))]`. The next-step prior is `P(L next) = posterior + (1-posterior)P(T)`. The observation posterior and next prior are persisted separately.

Quiz accuracy is the fraction of correct answers in one session. BKT mastery is a sequential probability conditioned on prior observations and the model assumptions; neither is verified professional competence.

## Reproducible synthetic demonstration

Starting at 0.25, two correct responses increase the trajectory substantially; two incorrect responses lower the observation posteriors while the transition still represents possible learning between opportunities. Run `pytest tests/test_bkt.py` to reproduce the hand-calculated first updates. This is an illustrative synthetic comparison, not empirical validation.

Evaluation should report predictive log loss/calibration on held-out labeled interactions once enough real data exists, and compare it with a naive quiz-score threshold. Current evaluation verifies equations, boundaries, isolation, persistence, leakage prevention, idempotency, and deterministic recommendations only.

Limitations include fixed parameters, binary observations, one concept per item, conditional-independence assumptions, no forgetting term, sensitivity to question quality, and cold-start uncertainty. Curated questions alone can affect mastery; Groq-generated questions must remain `pending_review` until an approved answer key review.
