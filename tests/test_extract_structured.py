import json
import pytest
import tempfile
from pathlib import Path
from src.ingestion.structured import extract_structured, _parse_llm_json
from src.llm.stub import StubProvider


class TestParseJson:
    def test_plain_json(self):
        result = _parse_llm_json('{"key": "value"}')
        assert result == {"key": "value"}

    def test_markdown_fenced_json(self):
        raw = '```json\n{"key": "value"}\n```'
        result = _parse_llm_json(raw)
        assert result == {"key": "value"}

    def test_invalid_json_raises(self):
        with pytest.raises(json.JSONDecodeError):
            _parse_llm_json("not json at all")


class TestExtractStructured:
    def test_stub_extraction_produces_json(self):
        provider = StubProvider()
        with tempfile.TemporaryDirectory() as tmpdir:
            text_dir = Path(tmpdir) / "text"
            out_dir = Path(tmpdir) / "out"
            text_dir.mkdir()

            # Write a sample text file
            (text_dir / "test-001.txt").write_text("Sample incident narrative about a gas release.")

            rows = extract_structured(text_dir, out_dir, provider, "stub")

            assert len(rows) == 1
            assert rows[0].extracted is True
            assert rows[0].incident_id == "test-001"

            # Check JSON was written
            json_path = out_dir / "test-001.json"
            assert json_path.exists()
            data = json.loads(json_path.read_text())
            assert data["incident_id"] == "test-001"

    def test_empty_text_file_skipped(self):
        provider = StubProvider()
        with tempfile.TemporaryDirectory() as tmpdir:
            text_dir = Path(tmpdir) / "text"
            out_dir = Path(tmpdir) / "out"
            text_dir.mkdir()

            (text_dir / "empty.txt").write_text("")

            rows = extract_structured(text_dir, out_dir, provider, "stub")
            assert len(rows) == 1
            assert rows[0].extracted is False
            assert rows[0].error == "Empty text file"

    def test_no_files_returns_empty(self):
        provider = StubProvider()
        with tempfile.TemporaryDirectory() as tmpdir:
            text_dir = Path(tmpdir) / "text"
            out_dir = Path(tmpdir) / "out"
            text_dir.mkdir()

            rows = extract_structured(text_dir, out_dir, provider, "stub")
            assert rows == []

    def test_multiple_files_processed(self):
        provider = StubProvider()
        with tempfile.TemporaryDirectory() as tmpdir:
            text_dir = Path(tmpdir) / "text"
            out_dir = Path(tmpdir) / "out"
            text_dir.mkdir()

            (text_dir / "inc-001.txt").write_text("Incident one narrative.")
            (text_dir / "inc-002.txt").write_text("Incident two narrative.")

            rows = extract_structured(text_dir, out_dir, provider, "stub")
            assert len(rows) == 2
            assert all(r.extracted for r in rows)
