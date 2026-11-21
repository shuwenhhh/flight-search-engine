from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from datetime import date, datetime, timedelta, timezone
from functools import lru_cache
from pathlib import Path
from zoneinfo import ZoneInfo


DATA_FILE = Path(__file__).resolve().parents[1] / "data" / "flights.json"
DOMESTIC_MIN_LAYOVER_MINUTES = 45
INTERNATIONAL_MIN_LAYOVER_MINUTES = 90
MAX_SEGMENTS = 3


@dataclass(frozen=True)
class Airport:
    code: str
    name: str
    city: str
    country: str
    timezone: str


@dataclass(frozen=True)
class FlightRecord:
    flight_number: str
    airline: str
    origin: str
    destination: str
    departure: datetime
    arrival: datetime
    price: float
    aircraft: str


@dataclass(frozen=True)
class Segment:
    flight_number: str
    airline: str
    aircraft: str
    origin: str
    destination: str
    departure_local: str
    arrival_local: str
    duration_minutes: int


@dataclass(frozen=True)
class Itinerary:
    id: str
    segments: tuple[Segment, ...]
    total_duration_minutes: int
    price_usd: float
    layover_minutes: tuple[int, ...]
    minimum_layover_minutes: int | None

    def to_dict(self) -> dict:
        result = asdict(self)
        result["stops"] = len(self.segments) - 1
        result["is_direct"] = len(self.segments) == 1
        return result


@lru_cache(maxsize=1)
def load_dataset() -> tuple[dict[str, Airport], tuple[FlightRecord, ...]]:
    raw = json.loads(DATA_FILE.read_text(encoding="utf-8"))
    airports = {item["code"].upper(): Airport(**item) for item in raw["airports"]}
    flights: list[FlightRecord] = []
    for item in raw["flights"]:
        origin = item.get("origin", "").upper()
        destination = item.get("destination", "").upper()
        if origin not in airports or destination not in airports or origin == destination:
            continue
        try:
            departure = datetime.fromisoformat(item["departureTime"]).replace(tzinfo=ZoneInfo(airports[origin].timezone))
            arrival = datetime.fromisoformat(item["arrivalTime"]).replace(tzinfo=ZoneInfo(airports[destination].timezone))
            price = float(item["price"])
        except (KeyError, TypeError, ValueError):
            continue
        if arrival.astimezone(timezone.utc) <= departure.astimezone(timezone.utc):
            continue
        flights.append(FlightRecord(
            flight_number=item["flightNumber"], airline=item["airline"], origin=origin,
            destination=destination, departure=departure, arrival=arrival,
            price=price, aircraft=item["aircraft"],
        ))
    return airports, tuple(sorted(flights, key=lambda flight: flight.departure.astimezone(timezone.utc)))


def list_airports() -> list[dict[str, str]]:
    airports, _ = load_dataset()
    return [asdict(airport) for airport in sorted(airports.values(), key=lambda airport: (airport.city, airport.code))]


def _minutes(delta: timedelta) -> int:
    return round(delta.total_seconds() / 60)


def _minimum_layover(
    arriving: FlightRecord,
    departing: FlightRecord,
    airports: dict[str, Airport],
) -> int:
    countries = {
        airports[arriving.origin].country,
        airports[arriving.destination].country,
        airports[departing.origin].country,
        airports[departing.destination].country,
    }
    return DOMESTIC_MIN_LAYOVER_MINUTES if len(countries) == 1 else INTERNATIONAL_MIN_LAYOVER_MINUTES


def _to_itinerary(path: tuple[FlightRecord, ...], airports: dict[str, Airport]) -> Itinerary:
    segments = tuple(Segment(
        flight_number=flight.flight_number,
        airline=flight.airline,
        aircraft=flight.aircraft,
        origin=flight.origin,
        destination=flight.destination,
        departure_local=flight.departure.isoformat(),
        arrival_local=flight.arrival.isoformat(),
        duration_minutes=_minutes(flight.arrival.astimezone(timezone.utc) - flight.departure.astimezone(timezone.utc)),
    ) for flight in path)
    layovers = tuple(_minutes(current.departure.astimezone(timezone.utc) - previous.arrival.astimezone(timezone.utc)) for previous, current in zip(path, path[1:]))
    minimum_layovers = tuple(
        _minimum_layover(previous, current, airports)
        for previous, current in zip(path, path[1:])
    )
    total = _minutes(path[-1].arrival.astimezone(timezone.utc) - path[0].departure.astimezone(timezone.utc))
    return Itinerary(
        id="-".join(flight.flight_number for flight in path), segments=segments,
        total_duration_minutes=total, price_usd=round(sum(flight.price for flight in path), 2),
        layover_minutes=layovers,
        minimum_layover_minutes=max(minimum_layovers) if minimum_layovers else None,
    )


def search_flights(origin: str, destination: str, travel_date: date) -> list[dict]:
    airports, flights = load_dataset()
    origin = origin.upper().strip()
    destination = destination.upper().strip()
    invalid = [code for code in (origin, destination) if code not in airports]
    if invalid:
        raise ValueError(f"Unknown airport code: {', '.join(invalid)}")
    if origin == destination:
        raise ValueError("Origin and destination must be different")

    departures: dict[str, list[FlightRecord]] = {}
    for flight in flights:
        departures.setdefault(flight.origin, []).append(flight)

    matches: list[tuple[FlightRecord, ...]] = []

    def walk(path: tuple[FlightRecord, ...], visited: frozenset[str]) -> None:
        last = path[-1]
        if last.destination == destination:
            matches.append(path)
            return
        if len(path) >= MAX_SEGMENTS:
            return
        for candidate in departures.get(last.destination, []):
            minimum_layover = _minimum_layover(last, candidate, airports)
            earliest = last.arrival.astimezone(timezone.utc) + timedelta(minutes=minimum_layover)
            candidate_departure = candidate.departure.astimezone(timezone.utc)
            if candidate.destination in visited or candidate_departure < earliest:
                continue
            if candidate_departure - last.arrival.astimezone(timezone.utc) > timedelta(hours=6):
                continue
            walk(path + (candidate,), visited | {candidate.destination})

    for first in departures.get(origin, []):
        if first.departure.date() == travel_date:
            walk((first,), frozenset({origin, first.destination}))

    itineraries = [_to_itinerary(path, airports) for path in matches]
    unique = {itinerary.id: itinerary for itinerary in itineraries}
    ordered = sorted(unique.values(), key=lambda item: (item.total_duration_minutes, item.price_usd, item.id))
    return [itinerary.to_dict() for itinerary in ordered[:50]]
