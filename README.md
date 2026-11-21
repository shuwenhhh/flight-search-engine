# SkyPath

SkyPath is a full-stack flight connection search prototype. It loads the provided schedule dataset, finds direct and connecting itineraries, applies connection rules at each layover, calculates elapsed time across time zones, and displays the results in a responsive interface.

## Features

- Search by origin, destination, and local departure date.
- Direct, one-stop, and two-stop itineraries.
- Domestic and international minimum connection times applied per layover.
- Six-hour maximum layover and no airport changes.
- Time-zone-aware segment, layover, and total-duration calculations.
- Results sorted by total travel time, with fastest and cheapest controls in the UI.
- Loading, empty, validation, and API-error states.
- Detailed local dates, times, time zones, layovers, durations, and prices.

## How to run the application

### Docker Compose

Docker Desktop or another Compose-compatible Docker installation is required.

```bash
cp .env.example .env
docker compose up --build
```

The legacy command is also supported by compatible Docker installations:

```bash
docker-compose up --build
```

Open:

- Frontend: http://localhost:5173
- Backend health check: http://localhost:8000/health
- Interactive API documentation: http://localhost:8000/docs

Stop the services with `Ctrl+C`, followed by:

```bash
docker compose down
```

Use `docker compose up --build -d` to run in the background.

### Run locally without Docker

Backend (Python 3.12+):

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt -r requirements-dev.txt
uvicorn app.main:app --reload
```

Frontend (Node.js 20+), in another terminal:

```bash
cd frontend
npm install
npm run dev
```

The frontend uses `VITE_API_BASE_URL` and defaults to `http://127.0.0.1:8000`. The Compose setup uses the value from `.env`.

## API

Search for itineraries:

```http
GET /flights/search?origin=JFK&destination=LAX&date=2024-03-15
```

Each itinerary includes ordered flight segments, local timestamps, segment durations, layover durations, total elapsed duration, total USD price, and stop information. Unknown airports and identical origin/destination values return HTTP 422 with a clear message. A valid search without matching schedules returns an empty result list.

List the dataset airports:

```http
GET /airports
```

## Architecture decisions and why

### Backend owns search correctness

FastAPI owns dataset validation, connection rules, time calculations, and default result ordering. React is an API client responsible for input and presentation. Keeping the rules in one backend module prevents the browser and API from producing different answers and makes the core behavior easy to test without a UI.

### Load once at application startup

The dataset is loaded and validated during the FastAPI application lifespan, then cached for the process lifetime. Requests do not repeatedly parse the JSON file. Rows with unknown airports, identical endpoints, invalid prices or timestamps, or non-positive real elapsed time are excluded.

### Bounded graph traversal

Flights are indexed by origin airport. For each flight departing from the requested origin on the requested local date, a depth-limited traversal explores valid onward flights. Paths contain at most three segments, which directly represents the requirement for direct, one-stop, and two-stop results. Visited airports prevent cycles.

This approach is simple and deterministic for the supplied static dataset. Indexing flights by origin avoids scanning every flight at every connection. Results are deduplicated by their ordered flight-number path and sorted by total elapsed time, then price, then a stable identifier. The API returns at most 50 ordered results to keep the prototype response manageable.

### Evaluate rules per connection

Connection rules are evaluated independently at every layover:

- Domestic connection: minimum 45 minutes.
- International connection: minimum 90 minutes.
- All connections: maximum six hours.
- The onward flight must depart from the airport where the previous flight arrived.

A connection is domestic only when both adjacent flights are entirely within the same country. For example, `JFK → ORD → LAX` uses the 45-minute rule. A connection adjacent to an international segment, such as `MEX → DFW → ORD`, uses the 90-minute rule at DFW.

### Normalize time for calculations, preserve local time for display

Dataset timestamps are local airport times without embedded offsets. Each timestamp is assigned the airport's IANA time zone. Durations and chronological comparisons are calculated in UTC, while API timestamps retain the local offset for display.

This handles international date-line routes correctly. A `SYD → LAX` arrival may appear earlier than departure when comparing local clock values while still having a positive 15-hour elapsed duration.

### Frontend states are explicit

The React interface models loading, success, empty, and error states separately. Airport inputs require a dataset-backed selection, while the backend remains the final validation boundary. Flight details are displayed in a modal so the main results remain easy to compare.

## Tradeoffs considered

- **In-memory JSON instead of a database:** The supplied dataset is small and read-only, so a database would add setup and operational complexity without improving this prototype. A live or much larger schedule would need persistent storage and stronger indexing.
- **Depth-limited traversal instead of a general route planner:** The requirement allows at most two stops, making a bounded traversal easier to reason about and test. A larger network would benefit from a dedicated graph model, stronger pruning, and pagination.
- **Skip malformed rows instead of failing the complete import:** One bad fixture does not make the application unusable. In production, rejected rows should also produce structured logs, metrics, and an ingestion report.
- **Return at most 50 itineraries:** This keeps payload and rendering costs predictable, but a production API should expose pagination and make ranking configurable.
- **Development-oriented Compose setup:** Bind mounts and development servers make evaluator iteration fast. Production deployment should use immutable images, a production static server, health checks, and stricter CORS configuration.
- **Local booking interaction only:** The “Choose” action demonstrates the UI state but intentionally does not create a reservation because booking is outside the challenge scope.
- **Simple presentation assets:** Typographic airline marks keep the prototype lightweight; licensed airline assets would improve brand fidelity.

## Dataset assumptions and quirks

- The query date refers to the first segment's local departure date.
- Prices are normalized to numeric USD values.
- Invalid airport references such as `JKF` are rejected during loading.
- The challenge notes mention overnight arrivals on `2024-03-16`, but the supplied JSON also contains valid local arrivals on `2024-03-17` (`SP501`, `SP511`, and `SP542`). SkyPath preserves those source dates.
- The dataset is treated as schedule data, not live availability or fare inventory.

## Testing

Run the backend suite:

```bash
cd backend
PYTHONPATH=. python -m pytest
```

Run frontend checks:

```bash
cd frontend
npm run lint
npm run build
```

The backend suite covers the six supplied acceptance scenarios plus startup loading, sorting, known itinerary totals, invalid dates and rows, maximum layovers, local offsets, date-line behavior, and mixed domestic/international connections.

| Search | Expected behavior |
| --- | --- |
| JFK → LAX, 2024-03-15 | Direct and connecting options |
| SFO → NRT, 2024-03-15 | International connection minimums |
| BOS → SEA, 2024-03-15 | Connections only |
| JFK → JFK, 2024-03-15 | Validation error |
| XXX → LAX, 2024-03-15 | Unknown-airport error |
| SYD → LAX, 2024-03-15 | Correct date-line calculation |

## What I would improve with more time

- Add React component tests and end-to-end browser tests for search, sorting, empty/error states, and modal accessibility.
- Return the required minimum connection time for every layover instead of one itinerary-level summary value.
- Add API pagination, configurable ranking, and stronger pruning for larger schedules.
- Add structured startup logging and explicit diagnostics for rejected dataset rows.
- Add Docker health checks and wait for backend readiness before starting the frontend.
- Build and serve the frontend through a minimal production web-server image.
- Add focus trapping and focus restoration to the itinerary modal.
- Upgrade and continuously audit frontend build dependencies.

## Project structure

```text
.
├── backend/
│   ├── app/                 # FastAPI routes and search engine
│   ├── data/flights.json    # Supplied schedule dataset
│   └── tests/               # API and search tests
├── frontend/
│   └── src/                 # React application
├── compose.yaml             # Local two-service environment
├── design/                  # UI reference material
└── design-qa.md             # Visual and interaction QA notes
```
