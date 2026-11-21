/// <reference types="vite/client" />
import { Fragment, useEffect, useMemo, useState } from 'react'

type SortKey = 'Recommended' | 'Cheapest' | 'Fastest'
type Airport = { code: string; city: string; name: string; region: string }
type SearchStatus = 'success' | 'loading' | 'empty' | 'error'
type ApiSegment = { flight_number: string; origin: string; destination: string; departure_local: string; arrival_local: string; duration_minutes: number }
type ApiItinerary = { id: string; segments: ApiSegment[]; total_duration_minutes: number; price_usd: number; layover_minutes: number[]; minimum_layover_minutes: number | null; stops: number; is_direct: boolean }
type ApiResponse = { origin: string; destination: string; date: string; count: number; results: ApiItinerary[] }
type Flight = ApiItinerary & { airline: string; code: string }

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000'
const airports: Airport[] = [
  { code: 'JFK', city: 'New York', name: 'John F. Kennedy International Airport', region: 'New York, US' },
  { code: 'LAX', city: 'Los Angeles', name: 'Los Angeles International Airport', region: 'California, US' },
  { code: 'SFO', city: 'San Francisco', name: 'San Francisco International Airport', region: 'California, US' },
  { code: 'NRT', city: 'Tokyo', name: 'Narita International Airport', region: 'Japan' },
  { code: 'BOS', city: 'Boston', name: 'Boston Logan International Airport', region: 'Massachusetts, US' },
  { code: 'SEA', city: 'Seattle', name: 'Seattle–Tacoma International Airport', region: 'Washington, US' },
  { code: 'SYD', city: 'Sydney', name: 'Sydney Kingsford Smith Airport', region: 'Australia' },
  { code: 'HND', city: 'Tokyo', name: 'Tokyo Haneda Airport', region: 'Japan' },
  { code: 'LAS', city: 'Las Vegas', name: 'Harry Reid International Airport', region: 'Nevada, US' },
  { code: 'LHR', city: 'London', name: 'Heathrow Airport', region: 'United Kingdom' },
]
const monthLabels = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const weekdayLabels = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

function calendarCells(year: number, month: number) {
  return [...Array(new Date(year, month, 1).getDay()).fill(null), ...Array.from({ length: new Date(year, month + 1, 0).getDate() }, (_, index) => index + 1)]
}
function toDateValue(year: number, month: number, day: number) { return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` }
function durationLabel(minutes: number) { return `${Math.floor(minutes / 60)}h ${minutes % 60}m` }
function timeLabel(iso: string) {
  const [hoursText, minutes] = iso.slice(11, 16).split(':')
  const hours = Number(hoursText)
  return `${hours % 12 || 12}:${minutes} ${hours >= 12 ? 'PM' : 'AM'}`
}
function airlineName(number: string) {
  const prefix = number.split(' ')[0]
  return ({ AA: 'American Airlines', AS: 'Alaska Airlines', JL: 'Japan Airlines', UA: 'United Airlines', DL: 'Delta Air Lines', QF: 'Qantas' } as Record<string, string>)[prefix] ?? 'Partner airline'
}
function asFlight(itinerary: ApiItinerary): Flight {
  return { ...itinerary, airline: airlineName(itinerary.segments[0].flight_number), code: itinerary.segments.map((segment) => segment.flight_number).join(' · ') }
}
async function requestFlights(origin: string, destination: string, date: string): Promise<Flight[]> {
  const params = new URLSearchParams({ origin, destination, date })
  const response = await fetch(`${API_BASE_URL}/flights/search?${params}`)
  const body = await response.json() as ApiResponse | { detail?: string }
  if (!response.ok) throw new Error('detail' in body && body.detail ? body.detail : 'The flight service returned an error.')
  return (body as ApiResponse).results.map(asFlight)
}

function App() {
  const [origin, setOrigin] = useState(airports[0])
  const [destination, setDestination] = useState(airports[1])
  const [originQuery, setOriginQuery] = useState('New York (JFK)')
  const [destinationQuery, setDestinationQuery] = useState('Los Angeles (LAX)')
  const [departDate, setDepartDate] = useState('2026-11-24')
  const [results, setResults] = useState<Flight[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [sort, setSort] = useState<SortKey>('Fastest')
  const [searchOpen, setSearchOpen] = useState(false)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [activeAirportField, setActiveAirportField] = useState<'origin' | 'destination' | null>(null)
  const [searchStatus, setSearchStatus] = useState<SearchStatus>('loading')
  const [searchError, setSearchError] = useState('')
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [chosen, setChosen] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)

  const performSearch = async (from: Airport, to: Airport, date: string, closeForm = true) => {
    setCalendarOpen(false); setSearchStatus('loading'); setSearchError('')
    try {
      const flights = await requestFlights(from.code, to.code, date)
      setResults(flights); setSelectedId(flights[0]?.id ?? '')
      setSearchStatus(flights.length ? 'success' : 'empty')
      if (closeForm) setSearchOpen(false)
    } catch (error) {
      setResults([]); setSearchStatus('error'); setSearchError(error instanceof Error ? error.message : 'Unable to load flights.')
    }
  }
  useEffect(() => { void performSearch(airports[0], airports[1], '2026-11-24') }, [])
  useEffect(() => {
    if (!detailsOpen) return
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setDetailsOpen(false) }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [detailsOpen])

  const orderedFlights = useMemo(() => {
    const next = [...results]
    if (sort === 'Cheapest') next.sort((a, b) => a.price_usd - b.price_usd)
    else if (sort === 'Fastest') next.sort((a, b) => a.total_duration_minutes - b.total_duration_minutes)
    return next
  }, [results, sort])
  const selected = results.find((flight) => flight.id === selectedId) ?? orderedFlights[0]
  const airportSuggestions = (query: string) => {
    const normalized = query.trim().toLowerCase()
    return airports.filter((airport) => !normalized || `${airport.code} ${airport.city} ${airport.name} ${airport.region}`.toLowerCase().includes(normalized)).slice(0, 6)
  }
  const selectAirport = (field: 'origin' | 'destination', airport: Airport) => {
    if (field === 'origin') { setOrigin(airport); setOriginQuery(`${airport.city} (${airport.code})`) }
    else { setDestination(airport); setDestinationQuery(`${airport.city} (${airport.code})`) }
    setFormErrors((errors) => ({ ...errors, [field]: '' })); setActiveAirportField(null)
  }
  const runSearch = () => {
    const errors: Record<string, string> = {}
    if (originQuery !== `${origin.city} (${origin.code})`) errors.origin = 'Choose an origin from the airport suggestions.'
    if (destinationQuery !== `${destination.city} (${destination.code})`) errors.destination = 'Choose a destination from the airport suggestions.'
    if (origin.code === destination.code) errors.destination = 'Origin and destination must be different.'
    if (!departDate) errors.dates = 'Choose a departure date.'
    setFormErrors(errors)
    if (!Object.keys(errors).length) void performSearch(origin, destination, departDate)
  }

  return <main className="app-shell" id="top">
    <header className="topbar"><a className="brand" href="#top">SkyPath</a><nav className="primary-nav"><a className="active" href="#flights">Flights</a><a href="#trips">Trips</a><a href="#bookings">My bookings</a></nav><div className="today">API-connected search</div><button className="account-button">Account</button></header>
    <section className={`search-summary ${searchOpen ? 'editing' : ''}`}>
      <button className="search-cell trip-type">One way</button>
      <div className="search-cell route-cell"><div><strong>{origin.code}</strong><span>{origin.city}</span></div><div className="swap">to</div><div><strong>{destination.code}</strong><span>{destination.city}</span></div></div>
      <button className="search-cell" onClick={() => { setSearchOpen(true); setCalendarOpen(true) }}><strong>{departDate}</strong></button>
      <button className="search-cell"><strong>1 traveler</strong></button><button className="search-cell"><strong>Economy</strong></button>
      <button className="edit-search" onClick={() => setSearchOpen((open) => !open)}>{searchOpen ? 'Done' : 'Edit search'}</button>
    </section>
    {searchOpen && <section className="edit-panel" aria-label="Edit flight search">
      {(['origin', 'destination'] as const).map((field) => { const query = field === 'origin' ? originQuery : destinationQuery; return <div className="airport-field" key={field}><label htmlFor={`${field}-airport`}>{field === 'origin' ? 'From' : 'To'}</label><input id={`${field}-airport`} role="combobox" aria-expanded={activeAirportField === field} aria-invalid={Boolean(formErrors[field])} autoComplete="off" value={query} onFocus={() => setActiveAirportField(field)} onChange={(event) => { if (field === 'origin') setOriginQuery(event.target.value); else setDestinationQuery(event.target.value); setActiveAirportField(field) }} />{activeAirportField === field && <div className="airport-suggestions" role="listbox">{airportSuggestions(query).map((airport) => <button type="button" role="option" key={airport.code} onMouseDown={(event) => event.preventDefault()} onClick={() => selectAirport(field, airport)}><strong>{airport.code}</strong><span><b>{airport.city}</b>{airport.name}<small>{airport.region}</small></span></button>)}{!airportSuggestions(query).length && <p>No matching airports</p>}</div>}{formErrors[field] && <p className="field-error">{formErrors[field]}</p>}</div> })}
      <div className="date-picker-field"><span className="field-label">Departure date</span><button className="calendar-trigger single-date" type="button" aria-expanded={calendarOpen} onClick={() => setCalendarOpen((open) => !open)}><span><small>Depart</small>{departDate}</span></button>{calendarOpen && <div className="calendar-popover"><div className="calendar-instruction">Select departure date</div><div className="calendar-months">{[[2026, 10], [2026, 11]].map(([year, month]) => <section className="calendar-month" key={`${year}-${month}`}><h4>{monthLabels[month]} {year}</h4><div className="calendar-weekdays">{weekdayLabels.map((day) => <span key={day}>{day}</span>)}</div><div className="calendar-days">{calendarCells(year, month).map((day, index) => day === null ? <span key={`blank-${index}`} /> : (() => { const value = toDateValue(year, month, day); return <button type="button" key={value} className={value === departDate ? 'selected-date' : ''} onClick={() => { setDepartDate(value); setCalendarOpen(false) }}>{day}</button> })())}</div></section>)}</div></div>}{formErrors.dates && <p className="field-error">{formErrors.dates}</p>}</div>
      <div className="search-actions"><p>Results are loaded from the FastAPI backend.</p><button className="submit-search" disabled={searchStatus === 'loading'} onClick={runSearch}>{searchStatus === 'loading' ? 'Searching flights…' : 'Search flights'}</button></div>
    </section>}
    <section className="workspace single" id="flights">
      <div className="results-pane"><div className="results-heading"><div><h1>Flights to {destination.code}</h1><p>{origin.city} ({origin.code}) → {destination.city} ({destination.code}) <span>·</span> {departDate}</p></div><div className="sort-tabs">{(['Recommended', 'Cheapest', 'Fastest'] as SortKey[]).map((key) => <button key={key} className={sort === key ? 'active' : ''} onClick={() => setSort(key)}>{key}</button>)}</div></div>
        {searchStatus === 'loading' && <div className="loading-state" role="status"><span className="loading-spinner" /><div><strong>Searching the API…</strong><p>Loading flight segments and connection rules.</p></div></div>}
        {searchStatus === 'empty' && <div className="message-state"><span className="state-kicker">No results</span><h2>No flights found for this route</h2><p>Try one of the supported test routes.</p><button onClick={() => setSearchOpen(true)}>Change search</button></div>}
        {searchStatus === 'error' && <div className="message-state error-state" role="alert"><span className="state-kicker">Search unavailable</span><h2>We couldn't load flight results</h2><p>{searchError}</p><button onClick={runSearch}>Try again</button></div>}
        {searchStatus === 'success' && <><p className="result-count">{results.length} flights found, sorted by {sort.toLowerCase()} · Select a flight to view details</p><div className="flight-list">{orderedFlights.map((flight) => { const first = flight.segments[0]; const last = flight.segments[flight.segments.length - 1]; const connection = flight.stops ? `${first.destination}, ${durationLabel(flight.layover_minutes[0])}` : undefined; return <button key={flight.id} className={`flight-row ${selected?.id === flight.id ? 'selected' : ''}`} onClick={() => { setSelectedId(flight.id); setChosen(false); setDetailsOpen(true) }}><div className="airline-block"><span className="airline-mark">{flight.airline.split(' ')[0]}</span><strong>{flight.airline}</strong><small>{flight.code}</small></div><div className="time-block"><strong>{timeLabel(first.departure_local)}</strong><span>{first.origin}</span></div><div className="route-line"><span>{durationLabel(flight.total_duration_minutes)}</span><div><i /><i /></div><small>{flight.is_direct ? 'Nonstop' : `${flight.stops} stop (${connection})`}</small></div><div className="time-block"><strong>{timeLabel(last.arrival_local)}</strong><span>{last.destination}</span></div><div className="price-block"><strong>${flight.price_usd}</strong><span>one way · View details</span></div></button> })}</div></>}
      </div>
    </section>
    {detailsOpen && searchStatus === 'success' && selected && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDetailsOpen(false) }}><section className="flight-modal" role="dialog" aria-modal="true" aria-labelledby="flight-detail-title"><button className="modal-close" aria-label="Close flight details" onClick={() => setDetailsOpen(false)}>Close</button><span className="eyebrow">Flight details</span><h2 id="flight-detail-title">{selected.segments[0].origin} → {selected.segments[selected.segments.length - 1].destination}</h2><p className="detail-meta">{departDate} <span>·</span> {selected.is_direct ? 'Nonstop' : `${selected.stops} stop`} <span>·</span> {durationLabel(selected.total_duration_minutes)} total</p><div className="detail-airline"><strong>{selected.airline}</strong><span>{selected.code}</span></div>
        <div className="segment-list">{selected.segments.map((segment, index) => <Fragment key={segment.flight_number}><div className="segment"><div className="segment-time"><strong>{timeLabel(segment.departure_local)}</strong><span>{segment.origin}</span></div><div><strong>{segment.origin} → {segment.destination}</strong><span>{segment.flight_number} · {durationLabel(segment.duration_minutes)}</span></div><div className="segment-arrival"><strong>{timeLabel(segment.arrival_local)}</strong><span>{segment.destination}</span></div></div>{index < selected.segments.length - 1 && <div className="layover"><div><strong>{durationLabel(selected.layover_minutes[index])} layover in {segment.destination}</strong><span>{selected.minimum_layover_minutes ? `International minimum: ${selected.minimum_layover_minutes} minutes` : 'Connection time included in total duration'}</span></div></div>}</Fragment>)}</div>
        {selected.layover_minutes.length > 0 && <section className="connection-info"><h3>Connection details</h3>{selected.layover_minutes.map((minutes, index) => <div key={index}><strong>{selected.segments[index].destination}</strong><span>{durationLabel(minutes)} layover{selected.minimum_layover_minutes ? ` · ${selected.minimum_layover_minutes}-minute minimum applies` : ''}</span></div>)}</section>}
        <button className={`choose-button ${chosen ? 'success' : ''}`} onClick={() => setChosen(true)}>{chosen ? 'Flight selected' : `Choose this flight — $${selected.price_usd} one way`}</button></section></div>}
  </main>
}

export default App
