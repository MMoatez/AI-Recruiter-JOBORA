# Annotation and review protocol

All v2 examples are explicitly synthetic and released for this project under CC0-1.0. They were constructed from common software-skill terminology; no external corpus, crowd workers, or independent human annotation is claimed.

## Labels

- **Equivalent (1.0):** both phrases assert substantially the same recruitable skill. Translation, spelling variants, and established aliases qualify.
- **Partial (0.5):** knowing one is relevant to the other, but they are not interchangeable evidence. Typical cases are language/framework, platform/service, or tool/plugin.
- **Non-equivalent (0.0):** distinct competence. Hard negatives should be plausibly confused because of spelling, ecosystem, or shared domain.

The label concerns semantic skill equivalence, not whether one technology can be used with another. When uncertain between adjacent labels, exclude the pair rather than force agreement.

## Review checklist

Before accepting a row:

1. Confirm both phrases are plausible CV or job-requirement expressions.
2. Confirm French text is idiomatic and preserves the English meaning.
3. Apply the definitions above without using embedding scores.
4. Confirm exactly one canonical family owns the row.
5. Confirm the family occurs in one split only.
6. Search for reversed, normalized, paraphrased, and near-duplicate pairs across splits.
7. For hard negatives, document that topical proximity is not skill identity.
8. Do not move or edit final-test examples after test evaluation begins.

The automated checker covers family overlap, exact/reversed normalized pairs, shared individual phrases, and high character-similarity near-duplicates. Semantic review remains necessary; passing automation is not proof of independent human review.
