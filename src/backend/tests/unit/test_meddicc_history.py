"""Unit tests for meddicc_history_service — spec 004 T011."""

import json
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import event
from sqlmodel import Session, SQLModel, create_engine

from app.models.lead import Lead
from app.models.lead_meddicc_evidence import LeadMeddiccEvidence
from app.models.lead_meddicc_history import LeadMeddiccHistory
from app.services.meddicc_history_service import (
    get_history,
    has_baseline,
    write_snapshot,
)


@pytest.fixture
def session():
    # Import all models for metadata registration
    from app.models import audit, auth, chat_audit, config, contact, conversation, customer  # noqa: F401
    from app.models import followup, key_event, lead_meddicc_evidence, lead_meddicc_history  # noqa: F401
    from app.models import llm_call_counter, llm_config, notification, org, report  # noqa: F401
    from app.models import lead as _lead_module  # noqa: F401

    eng = create_engine("sqlite://", connect_args={"check_same_thread": False})

    @event.listens_for(eng, "connect")
    def set_pragmas(dbapi_conn, _):
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA foreign_keys = ON")
        cursor.close()

    SQLModel.metadata.create_all(eng)

    with Session(eng) as s:
        from app.models.org import OrgNode, User

        s.add(OrgNode(id="org-1", name="root", type="root"))
        s.add(User(id="user-1", login="u1", password_hash="x", name="U1", org_node_id="org-1"))
        s.flush()
        yield s


def _create_lead(s, **overrides):
    base = dict(
        id="lead-x",
        company_name="A",
        region="华北",
        source="referral",
        owner_id="user-1",
        stage="active",
        forecast_category="进行中",
        meddicc_score=68,
        meddicc_completion=4,
    )
    base.update(overrides)
    lead = Lead(**base)
    s.add(lead)
    s.commit()
    s.refresh(lead)
    return lead


class TestWriteSnapshot:
    def test_writes_snapshot_with_current_lead_state(self, session):
        lead = _create_lead(session, amount=120000, forecast_category="必赢")
        snap = write_snapshot(lead.id, "analyze", session)
        assert snap is not None
        assert snap.lead_id == lead.id
        assert snap.meddicc_score == 68
        assert snap.meddicc_completion == 4
        assert snap.amount == 120000
        assert snap.forecast_category == "必赢"
        assert snap.trigger_reason == "analyze"

    def test_dimensions_json_includes_all_7_dims(self, session):
        lead = _create_lead(session)
        # Add some evidence
        session.add(LeadMeddiccEvidence(
            lead_id=lead.id, dimension="metrics", source_type="conversation",
            source_id="x", evidence_text="t", confidence=0.8,
        ))
        session.commit()
        snap = write_snapshot(lead.id, "backfill", session)
        parsed = json.loads(snap.dimensions_json)
        assert "metrics" in parsed
        assert parsed["metrics"]["lit"] is True
        assert parsed["metrics"]["evidence_count"] == 1
        assert parsed["pain"]["lit"] is False

    def test_invalid_trigger_reason_raises(self, session):
        lead = _create_lead(session)
        with pytest.raises(ValueError):
            write_snapshot(lead.id, "bogus", session)

    def test_returns_none_when_lead_missing(self, session):
        result = write_snapshot("nonexistent-id", "analyze", session)
        assert result is None


class TestGetHistory:
    def test_returns_recent_snapshots_ascending(self, session):
        lead = _create_lead(session)
        # Write 3 snapshots at different times
        old = LeadMeddiccHistory(
            lead_id=lead.id,
            snapshot_at=(datetime.now(timezone.utc) - timedelta(days=10)).isoformat(),
            meddicc_score=50,
            trigger_reason="backfill",
        )
        mid = LeadMeddiccHistory(
            lead_id=lead.id,
            snapshot_at=(datetime.now(timezone.utc) - timedelta(days=5)).isoformat(),
            meddicc_score=60,
            trigger_reason="analyze",
        )
        new = LeadMeddiccHistory(
            lead_id=lead.id,
            snapshot_at=datetime.now(timezone.utc).isoformat(),
            meddicc_score=70,
            trigger_reason="analyze",
        )
        session.add_all([old, mid, new])
        session.commit()

        rows = get_history(lead.id, session, since_days=30)
        assert len(rows) == 3
        # ascending order
        assert rows[0].meddicc_score == 50
        assert rows[2].meddicc_score == 70

    def test_filters_out_old_snapshots(self, session):
        lead = _create_lead(session)
        ancient = LeadMeddiccHistory(
            lead_id=lead.id,
            snapshot_at=(datetime.now(timezone.utc) - timedelta(days=100)).isoformat(),
            meddicc_score=20,
            trigger_reason="backfill",
        )
        recent = LeadMeddiccHistory(
            lead_id=lead.id,
            snapshot_at=datetime.now(timezone.utc).isoformat(),
            meddicc_score=70,
            trigger_reason="analyze",
        )
        session.add_all([ancient, recent])
        session.commit()
        rows = get_history(lead.id, session, since_days=30)
        assert len(rows) == 1
        assert rows[0].meddicc_score == 70


class TestHasBaseline:
    def test_returns_false_when_empty(self, session):
        lead = _create_lead(session)
        assert has_baseline(lead.id, session) is False

    def test_returns_true_after_snapshot(self, session):
        lead = _create_lead(session)
        write_snapshot(lead.id, "backfill", session)
        assert has_baseline(lead.id, session) is True
