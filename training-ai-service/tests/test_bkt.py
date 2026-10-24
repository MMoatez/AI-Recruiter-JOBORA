import pytest

from app.bkt import BKTParameters, recommendation_for, update_mastery


def test_correct_update_matches_manual_bayes_calculation():
    params = BKTParameters(initial_mastery=.25, learn=.12, guess=.2, slip=.1)
    update = update_mastery(.25, True, params)
    expected_posterior = (.25 * .9) / ((.25 * .9) + (.75 * .2))
    assert update.observation_posterior == pytest.approx(expected_posterior)
    assert update.next_prior == pytest.approx(expected_posterior + (1 - expected_posterior) * .12)


def test_incorrect_update_matches_manual_bayes_calculation():
    params = BKTParameters()
    update = update_mastery(.25, False, params)
    expected_posterior = (.25 * .1) / ((.25 * .1) + (.75 * .8))
    assert update.observation_posterior == pytest.approx(expected_posterior)
    assert update.next_prior == pytest.approx(expected_posterior + (1 - expected_posterior) * .12)


@pytest.mark.parametrize("field", ["initial_mastery", "learn", "guess", "slip"])
def test_parameter_boundaries(field):
    with pytest.raises(ValueError):
        BKTParameters(**{field: 1.01})


def test_recommendation_rules_are_deterministic():
    assert recommendation_for(.39)[0] == "foundational_review"
    assert recommendation_for(.7)[0] == "targeted_practice"
    assert recommendation_for(.9, 2)[0] == "advanced_tasks"
