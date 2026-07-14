"""Unit tests: dispatcher route generate uses real provider alternatives (not synthetic padding)."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from app.services.dispatch_route_selection import (
    _merge_distinct_road_options,
    generate_route_options_for_booking,
    route_options_meta_from_serialized,
    save_manual_route_option,
    serialize_route_option,
)
from app.services.road_routing import RoadRouteOption


def _booking(**kwargs):
    defaults = {
        "id": 42,
        "pickup_location": "Manila",
        "dropoff_location": "Cebu",
        "cargo_weight_tons": 10.0,
        "scheduled_time_slot": "08:00",
    }
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


def _db() -> MagicMock:
    db = MagicMock()
    db.query.return_value.filter.return_value.delete.return_value = None
    db.query.return_value.filter.return_value.update.return_value = None
    return db


def _road(km: float, seconds: float, idx: int, provider: str = "google_directions", summary: str | None = None):
    return RoadRouteOption(
        distance_km=km,
        duration_seconds=seconds,
        provider=provider,
        index=idx,
        summary=summary,
    )


def test_merge_avoid_tolls_only_when_metrics_differ():
    primary = [_road(100.0, 7200.0, 0), _road(110.0, 7800.0, 1)]
    same = [_road(100.1, 7250.0, 0, provider="google_directions_avoid_tolls")]
    merged_same = _merge_distinct_road_options(primary, same, max_options=3)
    assert len(merged_same) == 2

    distinct = [_road(130.0, 9000.0, 0, provider="google_directions_avoid_tolls")]
    merged = _merge_distinct_road_options(primary, distinct, max_options=3)
    assert len(merged) == 3
    assert merged[2].provider.endswith("avoid_tolls")


@patch("app.services.dispatch_route_selection._price_road_option")
@patch("app.services.dispatch_route_selection._resolve_road_options_for_dispatch")
def test_generate_persists_three_real_options_no_astar_padding(resolve_mock, price_mock):
    resolve_mock.return_value = (
        [
            _road(100.0, 7200.0, 0, summary="EDSA"),
            _road(115.0, 6900.0, 1, summary="SLEX"),
            _road(130.0, 8000.0, 2, provider="google_directions_avoid_tolls"),
        ],
        "google_directions",
        None,
    )
    price_mock.side_effect = [
        (100.0, 2.0, 500.0, 200.0),
        (115.0, 1.92, 550.0, 180.0),
        (130.0, 2.22, 600.0, 50.0),
    ]
    db = _db()
    options, warning = generate_route_options_for_booking(db, _booking())
    assert warning is None
    assert len(options) == 3
    assert all(o.is_selected is False or i == 0 for i, o in enumerate(options))
    assert options[0].is_selected is True
    serialized = [serialize_route_option(o) for o in options]
    assert all(s["source"] == "road" for s in serialized)
    meta = route_options_meta_from_serialized(serialized)
    assert meta["alternatives_available"] is True
    assert meta["routing_note"] is None
    # Strategy tags only from real multi-option set
    tags = {t for s in serialized for t in s["objective_tags"]}
    assert "Fastest Route" in tags or "Shortest Distance" in tags
    assert "Avoid Toll Roads" in tags


@patch("app.services.dispatch_route_selection._price_road_option")
@patch("app.services.dispatch_route_selection._resolve_road_options_for_dispatch")
def test_generate_single_option_marks_optimal_not_alternatives(resolve_mock, price_mock):
    resolve_mock.return_value = ([_road(95.0, 6000.0, 0)], "google_directions", None)
    price_mock.return_value = (95.0, 1.67, 400.0, 150.0)
    db = _db()
    options, _warning = generate_route_options_for_booking(db, _booking())
    assert len(options) == 1
    s = serialize_route_option(options[0])
    assert s["source"] == "road"
    assert s["route_name"] == "Optimal route"
    assert "Optimal route" in s["objective_tags"]
    assert "Fastest Route" not in s["objective_tags"]
    meta = route_options_meta_from_serialized([s])
    assert meta["alternatives_available"] is False
    assert meta["routing_note"] and "one optimal path" in meta["routing_note"].lower()


@patch("app.services.dispatch_route_selection._synthetic_direct_option")
@patch("app.services.dispatch_route_selection.estimate_road_distance_km_with_fallback")
@patch("app.services.dispatch_route_selection._resolve_road_options_for_dispatch")
def test_generate_falls_back_to_single_when_provider_unavailable(resolve_mock, est_mock, synth_mock):
    resolve_mock.return_value = ([], "unavailable", None)
    est_mock.return_value = (100.0, False, "map warn")
    from app.models.entities import RouteOption

    synth_mock.return_value = RouteOption(
        booking_id=42,
        rank=1,
        path_json='{"source":"fallback","name":"Fallback estimate","path":["A","B"],'
        '"duration_hours":2,"objective_tags":["Fallback estimate"],'
        '"routing_note":"Provider routing was unavailable","provider":"fallback"}',
        distance_km=100.0,
        fuel_cost=1.0,
        toll_cost=1.0,
        time_penalty=0.0,
        maintenance_penalty=0.0,
        total_cost=2.0,
        is_selected=True,
    )
    db = _db()
    options, warning = generate_route_options_for_booking(db, _booking())
    assert len(options) == 1
    assert warning == "map warn"
    s = serialize_route_option(options[0])
    assert s["source"] == "fallback"
    meta = route_options_meta_from_serialized([s])
    assert meta["alternatives_available"] is False


def test_manual_route_selects_operator_path():
    db = _db()
    booking = _booking()
    option = save_manual_route_option(
        db,
        booking,
        route_name="Operator path",
        distance_km=88.5,
        duration_hours=2.5,
        toll_cost_php=300,
        notes="Checked with fleet",
    )
    assert option.is_selected is True
    s = serialize_route_option(option)
    assert s["source"] == "manual"
    assert s["route_name"] == "Operator path"
    assert s["distance_km"] == 88.5
    assert "Manual Route" in s["objective_tags"]
    meta = route_options_meta_from_serialized([s])
    assert meta["alternatives_available"] is False


@patch("app.services.dispatch_route_selection.driving_route_alternatives")
@patch("app.services.dispatch_route_selection.geocode_coordinates")
def test_resolve_uses_same_alternatives_api_as_customer_quotes(geocode_mock, alts_mock):
    """Smoke: dispatcher resolve calls driving_route_alternatives like customer quotes."""
    from app.services.dispatch_route_selection import _resolve_road_options_for_dispatch

    geocode_mock.side_effect = [
        (14.5, 121.0, "nominatim"),
        (14.6, 121.1, "nominatim"),
    ]
    alts_mock.side_effect = [
        ([_road(100.0, 7000.0, 0), _road(110.0, 7500.0, 1)], "google_directions"),
        ([_road(100.0, 7000.0, 0, provider="google_directions_avoid_tolls")], "google_directions_avoid_tolls"),
    ]
    opts, provider, note = _resolve_road_options_for_dispatch(_booking())
    assert note is None
    assert provider == "google_directions"
    assert len(opts) >= 1
    # Primary want_alternatives=True + avoid_tolls strategy call
    assert alts_mock.call_count == 2
    first_kwargs = alts_mock.call_args_list[0].kwargs
    assert first_kwargs.get("want_alternatives") is True
    assert first_kwargs.get("max_options") == 3
    second_kwargs = alts_mock.call_args_list[1].kwargs
    assert second_kwargs.get("avoid_tolls") is True
