from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import date


AIRPORTS = {
    "BOS", "HND", "JFK", "LAS", "LAX", "LHR", "NRT", "SEA", "SFO", "SYD"
}


@dataclass(frozen=True)
class Segment:
    flight_number: str
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
    price_usd: int
    layover_minutes: tuple[int, ...] = ()
    minimum_layover_minutes: int | None = None

    def to_dict(self) -> dict:
        result = asdict(self)
        result["stops"] = len(self.segments) - 1
        result["is_direct"] = len(self.segments) == 1
        return result


def _segment(
    number: str,
    origin: str,
    destination: str,
    departure: str,
    arrival: str,
    duration: int,
) -> Segment:
    return Segment(number, origin, destination, departure, arrival, duration)


def _fixtures(travel_date: date) -> dict[tuple[str, str], list[Itinerary]]:
    day = travel_date.isoformat()
    return {
        ("JFK", "LAX"): [
            Itinerary("jfk-lax-direct", (_segment("AA 1", "JFK", "LAX", f"{day}T08:00:00-05:00", f"{day}T11:20:00-08:00", 380),), 380, 319),
            Itinerary("jfk-phx-lax", (
                _segment("AA 2821", "JFK", "PHX", f"{day}T07:15:00-05:00", f"{day}T10:20:00-07:00", 305),
                _segment("AA 1668", "PHX", "LAX", f"{day}T11:35:00-07:00", f"{day}T12:55:00-08:00", 80),
            ), 460, 268, (75,)),
        ],
        ("SFO", "NRT"): [
            Itinerary("sfo-sea-nrt-valid", (
                _segment("AS 1087", "SFO", "SEA", f"{day}T07:00:00-08:00", f"{day}T09:10:00-08:00", 130),
                _segment("JL 67", "SEA", "NRT", f"{day}T10:50:00-08:00", "2024-03-16T14:20:00+09:00", 630),
            ), 860, 742, (100,), 90),
        ],
        ("BOS", "SEA"): [
            Itinerary("bos-ord-sea", (
                _segment("UA 521", "BOS", "ORD", f"{day}T06:30:00-04:00", f"{day}T08:20:00-05:00", 170),
                _segment("UA 2091", "ORD", "SEA", f"{day}T09:35:00-05:00", f"{day}T11:55:00-07:00", 260),
            ), 505, 289, (75,)),
            Itinerary("bos-den-sea", (
                _segment("DL 1843", "BOS", "DEN", f"{day}T07:20:00-04:00", f"{day}T10:05:00-06:00", 285),
                _segment("DL 2310", "DEN", "SEA", f"{day}T11:30:00-06:00", f"{day}T13:25:00-07:00", 175),
            ), 545, 311, (85,)),
        ],
        ("SYD", "LAX"): [
            Itinerary("syd-lax-dateline", (
                _segment("QF 11", "SYD", "LAX", f"{day}T10:00:00+11:00", f"{day}T06:00:00-07:00", 840),
            ), 840, 981),
        ],
    }


def search_flights(origin: str, destination: str, travel_date: date) -> list[dict]:
    origin = origin.upper().strip()
    destination = destination.upper().strip()
    invalid = [code for code in (origin, destination) if code not in AIRPORTS]
    if invalid:
        raise ValueError(f"Unknown airport code: {', '.join(invalid)}")
    if origin == destination:
        raise ValueError("Origin and destination must be different")

    itineraries = _fixtures(travel_date).get((origin, destination), [])
    valid = [
        itinerary for itinerary in itineraries
        if itinerary.minimum_layover_minutes is None
        or all(minutes >= itinerary.minimum_layover_minutes for minutes in itinerary.layover_minutes)
    ]
    return [itinerary.to_dict() for itinerary in sorted(valid, key=lambda item: item.total_duration_minutes)]
