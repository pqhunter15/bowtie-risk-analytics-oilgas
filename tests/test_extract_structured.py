import json
import pytest
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from src.ingestion.structured import (
    extract_structured,
    load_structured_manifest,
    merge_structured_manifests,
    save_structured_manifest,
    StructuredManifestRow,
    _parse_llm_json,
)
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

            # Check JSON was written under provider subdir
            json_path = out_dir / "stub" / "test-001.json"
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


class TestManifestPersistence:
    def _make_row(self, incident_id: str) -> StructuredManifestRow:
        return StructuredManifestRow(
            incident_id=incident_id,
            source_text_path=f"text/{incident_id}.txt",
            output_json_path=f"out/{incident_id}.json",
            provider="stub",
            model=None,
            extracted=True,
            extracted_at=datetime(2025, 1, 1, tzinfo=timezone.utc),
            valid=True,
        )

    def test_save_and_load_roundtrip(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            manifest_path = Path(tmpdir) / "manifest.csv"
            original = [self._make_row("INC-001"), self._make_row("INC-002")]

            save_structured_manifest(original, manifest_path)
            loaded = load_structured_manifest(manifest_path)

            assert len(loaded) == 2
            assert loaded[0].incident_id == "INC-001"
            assert loaded[1].incident_id == "INC-002"
            assert loaded[0].extracted is True
            assert loaded[0].valid is True

    def test_load_nonexistent_returns_empty(self):
        loaded = load_structured_manifest(Path("/tmp/does_not_exist.csv"))
        assert loaded == []

    def test_merge_upserts_by_composite_key(self):
        old_row = self._make_row("INC-001")
        updated_row = self._make_row("INC-001")
        updated_row.valid = False
        updated_row.validation_errors = "some error"
        new_row = self._make_row("INC-002")

        merged = merge_structured_manifests([old_row], [updated_row, new_row])

        assert len(merged) == 2
        by_id = {r.incident_id: r for r in merged}
        assert by_id["INC-001"].valid is False  # new wins
        assert by_id["INC-001"].validation_errors == "some error"
        assert by_id["INC-002"].extracted is True

    def test_merge_preserves_different_providers_same_incident(self):
        """Same incident_id with different providers must coexist."""
        openai_row = self._make_row("INC-001")
        openai_row.provider = "openai"
        openai_row.model = "gpt-4o"
        openai_row.output_json_path = "out/openai/INC-001.json"

        anthropic_row = self._make_row("INC-001")
        anthropic_row.provider = "anthropic"
        anthropic_row.model = "claude-sonnet-4-5-20250929"
        anthropic_row.output_json_path = "out/anthropic/INC-001.json"

        merged = merge_structured_manifests([openai_row], [anthropic_row])

        assert len(merged) == 2
        providers = {r.provider for r in merged}
        assert providers == {"openai", "anthropic"}

    def test_output_json_path_includes_provider(self):
        """extract_structured must write JSON under out_dir/<provider>/."""
        provider = StubProvider()
        with tempfile.TemporaryDirectory() as tmpdir:
            text_dir = Path(tmpdir) / "text"
            out_dir = Path(tmpdir) / "out"
            text_dir.mkdir()
            (text_dir / "INC-042.txt").write_text("Some narrative.")

            rows = extract_structured(text_dir, out_dir, provider, "stub")

            assert len(rows) == 1
            assert "/stub/" in rows[0].output_json_path or "\\stub\\" in rows[0].output_json_path
            assert (out_dir / "stub" / "INC-042.json").exists()

    def test_extraction_preserves_prior_manifest_rows(self):
        """Regression: running extraction must not drop prior manifest rows."""
        provider = StubProvider()
        with tempfile.TemporaryDirectory() as tmpdir:
            text_dir = Path(tmpdir) / "text"
            out_dir = Path(tmpdir) / "out"
            manifest_path = Path(tmpdir) / "manifest.csv"
            text_dir.mkdir()

            # Seed manifest with a pre-existing row
            prior_row = self._make_row("PRIOR-001")
            save_structured_manifest([prior_row], manifest_path)

            # Create a new text file for extraction
            (text_dir / "NEW-001.txt").write_text("A new incident narrative.")

            # Run extraction → returns only NEW-001
            new_rows = extract_structured(text_dir, out_dir, provider, "stub")

            # Simulate what pipeline does: load + merge + save
            existing = load_structured_manifest(manifest_path)
            merged = merge_structured_manifests(existing, new_rows)
            save_structured_manifest(merged, manifest_path)

            # Reload and verify both rows survive
            final = load_structured_manifest(manifest_path)
            ids = {r.incident_id for r in final}
            assert "PRIOR-001" in ids, "Prior row was dropped!"
            assert "NEW-001" in ids, "New row was not added!"
            assert len(final) == 2

    def test_raw_response_path_per_provider(self):
        """raw_response_path must contain /raw/<provider>/ with correct separators."""
        provider = StubProvider()
        with tempfile.TemporaryDirectory() as tmpdir:
            text_dir = Path(tmpdir) / "text"
            out_dir = Path(tmpdir) / "out"
            text_dir.mkdir()
            (text_dir / "INC-099.txt").write_text("Some narrative.")

            for pname in ("stub", "anthropic", "openai"):
                rows = extract_structured(text_dir, out_dir, provider, pname)
                assert len(rows) == 1
                rp = rows[0].raw_response_path
                assert rp is not None
                # Path must contain /raw/<provider>/ (or backslash on Windows)
                assert f"raw/{pname}/" in rp.replace("\\", "/"), (
                    f"Expected 'raw/{pname}/' in {rp}"
                )
                assert Path(rp).exists()
