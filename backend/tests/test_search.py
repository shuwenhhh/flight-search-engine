from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def search(origin: str, destination: str):
    return client.get("/flights/search", params={
        "origin": origin,
        "destination": destination,
        "date": "2024-03-15",
    })


def test_jfk_to_lax_returns_direct_and_connecting_options() -> None:
    response = search("JFK", "LAX")
    assert response.status_code == 200
    results = response.json()["results"]
    assert any(result["is_direct"] for result in results)
    assert any(result["stops"] > 0 for result in results)


def test_sfo_to_nrt_enforces_90_minute_international_layover() -> None:
    response = search("SFO", "NRT")
    assert response.status_code == 200
    results = response.json()["results"]
    assert results
    assert all(min(result["layover_minutes"]) >= 90 for result in results)
    assert all(result["minimum_layover_minutes"] == 90 for result in results)


def test_bos_to_sea_returns_connections_only() -> None:
    response = search("BOS", "SEA")
    assert response.status_code == 200
    results = response.json()["results"]
    assert results
    assert all(not result["is_direct"] and result["stops"] >= 1 for result in results)


def test_same_origin_and_destination_is_rejected() -> None:
    response = search("JFK", "JFK")
    assert response.status_code == 422
    assert response.json()["detail"] == "Origin and destination must be different"


def test_invalid_airport_code_has_clear_error() -> None:
    response = search("XXX", "LAX")
    assert response.status_code == 422
    assert response.json()["detail"] == "Unknown airport code: XXX"


def test_syd_to_lax_preserves_local_times_across_date_line() -> None:
    response = search("SYD", "LAX")
    assert response.status_code == 200
    result = response.json()["results"][0]
    segment = result["segments"][0]
    assert segment["departure_local"] == "2024-03-15T10:00:00+11:00"
    assert segment["arrival_local"] == "2024-03-15T06:00:00-07:00"
    assert segment["arrival_local"][11:16] < segment["departure_local"][11:16]
    assert segment["duration_minutes"] == 840
