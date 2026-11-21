from fastapi.testclient import TestClient

from app.main import app
from app.search import load_dataset

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
    for result in results:
        assert all(45 <= minutes <= 360 for minutes in result["layover_minutes"])
        assert all(first["destination"] == second["origin"] for first, second in zip(result["segments"], result["segments"][1:]))


def test_sfo_to_nrt_enforces_90_minute_international_layover() -> None:
    response = search("SFO", "NRT")
    assert response.status_code == 200
    results = response.json()["results"]
    assert results
    connecting = [result for result in results if result["layover_minutes"]]
    assert connecting
    assert all(min(result["layover_minutes"]) >= 90 for result in connecting)
    assert all(result["minimum_layover_minutes"] == 90 for result in connecting)


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
    results = [result for result in response.json()["results"] if result["is_direct"]]
    assert len(results) == 2
    for result in results:
        segment = result["segments"][0]
        assert segment["departure_local"].startswith("2024-03-15")
        assert segment["arrival_local"].startswith("2024-03-15")
        assert segment["arrival_local"][11:16] < segment["departure_local"][11:16]
        assert segment["duration_minutes"] == 900


def test_airports_come_from_dataset() -> None:
    response = client.get("/airports")
    assert response.status_code == 200
    body = response.json()
    assert body["count"] == 25
    assert any(airport["code"] == "SYD" and airport["timezone"] == "Australia/Sydney" for airport in body["results"])


def test_invalid_dataset_rows_are_excluded_and_prices_are_normalized() -> None:
    airports, flights = load_dataset()

    assert flights
    assert all(flight.origin in airports and flight.destination in airports for flight in flights)
    assert all(flight.origin != flight.destination for flight in flights)
    assert all(isinstance(flight.price, float) for flight in flights)
    assert not any(flight.origin == "JKF" or flight.destination == "JKF" for flight in flights)
