import unittest

from app.generation import mock_finished, plan_slots, user_turn_count


class InterviewLogicTests(unittest.TestCase):
    def test_mixte_plans_requested_slots(self):
        self.assertEqual(
            plan_slots(["Python", "React"], "mixte", 5),
            [("Python", "qcm"), ("React", "ouverte"), ("Python", "technique"), ("RH", "rh"), ("React", "qcm")],
        )

    def test_mock_turn_count_ignores_recruiter_messages(self):
        history = [{"role": "assistant", "content": "Bonjour"}] + [
            {"role": "user", "content": str(index)} for index in range(5)
        ]
        self.assertEqual(user_turn_count(history), 5)
        self.assertTrue(mock_finished(history, 5))


if __name__ == "__main__":
    unittest.main()
