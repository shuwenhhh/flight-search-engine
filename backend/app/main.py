from datetime import date

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from app.search import list_airports, search_flights

app = FastAPI(
    title="SkyPath API",
    description="Backend foundation for the SkyPath take-home project.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["system"])
async def health_check() -> dict[str, str]:
    return {"status": "ok", "service": "skypath-api"}


@app.get("/flights/search", tags=["flights"])
async def flight_search(
    origin: str = Query(min_length=3, max_length=3),
    destination: str = Query(min_length=3, max_length=3),
    travel_date: date = Query(alias="date"),
) -> dict:
    try:
        results = search_flights(origin, destination, travel_date)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    return {
        "origin": origin.upper(),
        "destination": destination.upper(),
        "date": travel_date.isoformat(),
        "count": len(results),
        "results": results,
    }


@app.get("/airports", tags=["flights"])
async def airports() -> dict:
    results = list_airports()
    return {"count": len(results), "results": results}

