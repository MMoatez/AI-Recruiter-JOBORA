from pathlib import Path
import sys
import unittest


sys.path.insert(0, str(Path(__file__).resolve().parent))

from rag_store import split_document


class ChunkingTests(unittest.TestCase):
    def test_chunks_are_traceable_and_bounded(self):
        chunks = split_document("rules.txt", "A" * 500 + "\n\n" + "B" * 500, 600, 50)
        self.assertGreater(len(chunks), 1)
        self.assertTrue(all(chunk.source == "rules.txt" for chunk in chunks))
        self.assertTrue(all(len(chunk.id) == 24 for chunk in chunks))
        self.assertTrue(all(len(chunk.text) <= 600 for chunk in chunks))

    def test_chunk_ids_are_stable(self):
        first = split_document("rules.txt", "Use standard headings.")
        second = split_document("rules.txt", "Use standard headings.")
        self.assertEqual(first, second)


if __name__ == "__main__":
    unittest.main()
