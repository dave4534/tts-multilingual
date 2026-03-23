import unittest

from modal_app import main as longform


class SplitTextIntoSectionsTests(unittest.TestCase):
    def test_empty_text_returns_empty_list(self) -> None:
        self.assertEqual(longform.split_text_into_sections(""), [])

    def test_short_text_single_section(self) -> None:
        text = "one two three"
        sections = longform.split_text_into_sections(text, max_words=10)
        self.assertEqual(len(sections), 1)
        self.assertEqual(sections[0], "one two three")

    def test_long_text_multiple_sections(self) -> None:
        words = [f"w{i}" for i in range(25)]
        text = " ".join(words)
        sections = longform.split_text_into_sections(text, max_words=10)
        # 25 words with max 10 → 3 sections: 10, 10, 5
        self.assertEqual(len(sections), 3)
        self.assertEqual(" ".join(sections[0].split()), " ".join(words[:10]))
        self.assertEqual(" ".join(sections[1].split()), " ".join(words[10:20]))
        self.assertEqual(" ".join(sections[2].split()), " ".join(words[20:]))


class ParentAndSectionJobsTests(unittest.TestCase):
    def test_build_parent_and_section_jobs_shapes(self) -> None:
        text = " ".join(f"w{i}" for i in range(15))
        parent_id = "job-123"
        voice_id = "lucy"
        parent, sections = longform.build_parent_and_section_jobs(
            parent_id, text, voice_id, max_words=5
        )

        # Parent basics
        self.assertEqual(parent["id"], parent_id)
        self.assertEqual(parent["kind"], "parent")
        self.assertEqual(parent["voice_id"], voice_id)
        self.assertEqual(len(parent["section_ids"]), 3)

        # Section basics
        self.assertEqual(len(sections), 3)
        for idx, section in enumerate(sections):
            self.assertEqual(section["kind"], "section")
            self.assertEqual(section["parent_id"], parent_id)
            self.assertEqual(section["index"], idx)
            self.assertEqual(section["id"], parent["section_ids"][idx])
            self.assertEqual(section["voice_id"], voice_id)

        # Word distribution: 15 words → 3 sections of 5 words each
        all_words = text.split()
        for idx, section in enumerate(sections):
            section_words = section["text"].split()
            expected = all_words[idx * 5 : (idx + 1) * 5]
            self.assertEqual(section_words, expected)

    def test_compute_parent_progress_empty_sections(self) -> None:
        self.assertEqual(longform.compute_parent_progress([]), 0)

    def test_compute_parent_progress_averages_section_progress(self) -> None:
        sections = [
            {"progress": 0},
            {"progress": 50},
            {"progress": 100},
        ]
        # (0 + 50 + 100) / 3 = 50 (integer division)
        self.assertEqual(longform.compute_parent_progress(sections), 50)


if __name__ == "__main__":
    unittest.main()

