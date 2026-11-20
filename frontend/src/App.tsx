import { useMemo, useState } from 'react'

type Flight = { id: string; airline: string; code: string; departure: string; arrival: string; duration: string; stops: string; price: number; badge?: string; connection?: string }
type SortKey = 'Recommended' | 'Cheapest' | 'Fastest'
type Airport = { code: string; city: string; name: string; region: string }
type SearchStatus = 'success' | 'loading' | 'empty' | 'error'

const airports: Airport[] = [
  { code: 'SFO', city: 'San Francisco', name: 'San Francisco International Airport', region: 'California, US' },
  { code: 'LAX', city: 'Los Angeles', name: 'Los Angeles International Airport', region: 'California, US' },
  { code: 'LAS', city: 'Las Vegas', name: 'Harry Reid International Airport', region: 'Nevada, US' },
  { code: 'HND', city: 'Tokyo', name: 'Tokyo Haneda Airport', region: 'Japan' },
  { code: 'NRT', city: 'Tokyo', name: 'Narita International Airport', region: 'Japan' },
  { code: 'JFK', city: 'New York', name: 'John F. Kennedy International Airport', region: 'New York, US' },
  { code: 'EWR', city: 'Newark', name: 'Newark Liberty International Airport', region: 'New Jersey, US' },
  { code: 'SEA', city: 'Seattle', name: 'Seattle–Tacoma International Airport', region: 'Washington, US' },
  { code: 'ORD', city: 'Chicago', name: "O'Hare International Airport", region: 'Illinois, US' },
  { code: 'LHR', city: 'London', name: 'Heathrow Airport', region: 'United Kingdom' },
]

const monthLabels = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const weekdayLabels = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

function calendarCells(year: number, month: number) {
  const firstWeekday = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  return [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, index) => index + 1)]
}

function toDateValue(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

const flights: Flight[] = [
  { id: 'alaska', airline: 'Alaska Airlines', code: 'AS 330 · AS 13', departure: '10:20 AM', arrival: '4:55 PM', duration: '14h 35m', stops: '1 stop', connection: 'SEA, 1h 25m', price: 1198, badge: 'Recommended' },
  { id: 'jal', airline: 'Japan Airlines', code: 'JL 58', departure: '11:55 AM', arrival: '3:20 PM', duration: '11h 25m', stops: 'Nonstop', price: 1498 },
  { id: 'united', airline: 'United Airlines', code: 'UA 857 · UA 791', departure: '9:05 AM', arrival: '4:55 PM', duration: '15h 50m', stops: '1 stop', connection: 'LAX, 2h 10m', price: 1087 },
]

function App() {
  const [selectedId, setSelectedId] = useState('alaska')
  const [sort, setSort] = useState<SortKey>('Fastest')
  const [searchOpen, setSearchOpen] = useState(false)
  const [chosen, setChosen] = useState(false)
  const [origin, setOrigin] = useState(airports[0])
  const [destination, setDestination] = useState(airports[3])
  const [originQuery, setOriginQuery] = useState('San Francisco (SFO)')
  const [destinationQuery, setDestinationQuery] = useState('Tokyo (HND)')
  const [activeAirportField, setActiveAirportField] = useState<'origin' | 'destination' | null>(null)
  const [departDate, setDepartDate] = useState('2026-11-24')
  const [returnDate, setReturnDate] = useState('2026-12-02')
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [dateSelectionStep, setDateSelectionStep] = useState<'depart' | 'return'>('depart')
  const [searchStatus, setSearchStatus] = useState<SearchStatus>('success')
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const orderedFlights = useMemo(() => {
    const next = [...flights]
    if (sort === 'Cheapest') next.sort((a, b) => a.price - b.price)
    if (sort === 'Fastest') next.sort((a, b) => Number.parseInt(a.duration) - Number.parseInt(b.duration))
    return next
  }, [sort])
  const selected = flights.find((flight) => flight.id === selectedId) ?? flights[0]
  const connectionAirport = selected.id === 'united' ? 'LAX' : 'SEA'
  const connectionCity = selected.id === 'united' ? 'Los Angeles' : 'Seattle'
  const layoverDuration = selected.id === 'united' ? '2h 10m' : '1h 25m'
  const isNonstop = selected.id === 'jal'
  const airportSuggestions = (query: string) => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return airports.slice(0, 6)
    return airports.filter((airport) => `${airport.code} ${airport.city} ${airport.name} ${airport.region}`.toLowerCase().includes(normalized)).slice(0, 6)
  }
  const selectAirport = (field: 'origin' | 'destination', airport: Airport) => {
    if (field === 'origin') { setOrigin(airport); setOriginQuery(`${airport.city} (${airport.code})`); setFormErrors((errors) => ({ ...errors, origin: '' })) }
    else { setDestination(airport); setDestinationQuery(`${airport.city} (${airport.code})`); setFormErrors((errors) => ({ ...errors, destination: '' })) }
    setActiveAirportField(null)
  }
  const selectCalendarDate = (value: string) => {
    if (dateSelectionStep === 'depart' || value < departDate) {
      setDepartDate(value)
      if (returnDate < value) setReturnDate(value)
      setDateSelectionStep('return')
    } else {
      setReturnDate(value)
      setDateSelectionStep('depart')
      setCalendarOpen(false)
    }
  }
  const runSearch = async () => {
    const errors: Record<string, string> = {}
    if (originQuery !== `${origin.city} (${origin.code})`) errors.origin = 'Choose an origin from the airport suggestions.'
    if (destinationQuery !== `${destination.city} (${destination.code})`) errors.destination = 'Choose a destination from the airport suggestions.'
    if (origin.code === destination.code) errors.destination = 'Origin and destination must be different.'
    if (!departDate) errors.dates = 'Choose a departure date.'
    if (!returnDate) errors.dates = 'Choose a return date.'
    if (departDate && returnDate && returnDate < departDate) errors.dates = 'Return date must be after departure date.'
    setFormErrors(errors)
    if (Object.keys(errors).length > 0) return

    setCalendarOpen(false)
    setSearchStatus('loading')
    await new Promise((resolve) => window.setTimeout(resolve, 1100))
    if (origin.code === 'LHR' && destination.code === 'HND') setSearchStatus('error')
    else if (!(['SFO', 'LAX'].includes(origin.code) && destination.code === 'HND')) setSearchStatus('empty')
    else { setSearchStatus('success'); setSearchOpen(false) }
  }

  return (
    <main className="app-shell" id="top">
      <header className="topbar">
        <a className="brand" href="#top">SkyPath</a>
        <nav className="primary-nav" aria-label="Primary navigation"><a className="active" href="#flights">Flights</a><a href="#trips">Trips</a><a href="#bookings">My bookings</a></nav>
        <div className="today">Today: November 19, 2026</div>
        <button className="account-button" aria-label="Open account">Account</button>
      </header>

      <section className={`search-summary ${searchOpen ? 'editing' : ''}`} aria-label="Search summary">
        <button className="search-cell trip-type">Round trip</button>
        <div className="search-cell route-cell"><div><strong>{origin.code}</strong><span>{origin.city} ({origin.code})</span></div><div className="swap">to</div><div><strong>{destination.code}</strong><span>{destination.city} ({destination.code})</span></div></div>
        <button className="search-cell" onClick={() => { setSearchOpen(true); setCalendarOpen(true); setDateSelectionStep('depart') }}><strong>{departDate} – {returnDate}</strong></button>
        <button className="search-cell"><strong>1 traveler</strong></button>
        <button className="search-cell"><strong>Economy</strong></button>
        <button className="edit-search" onClick={() => setSearchOpen((open) => !open)}>{searchOpen ? 'Done' : 'Edit search'}</button>
      </section>
      {searchOpen && <section className="edit-panel" aria-label="Edit flight search">
        <div className="airport-field"><label htmlFor="origin-airport">From</label><input id="origin-airport" role="combobox" aria-expanded={activeAirportField === 'origin'} aria-controls="origin-suggestions" aria-invalid={Boolean(formErrors.origin)} autoComplete="off" value={originQuery} onFocus={() => setActiveAirportField('origin')} onChange={(event) => { setOriginQuery(event.target.value); setActiveAirportField('origin'); setFormErrors((errors) => ({ ...errors, origin: '' })) }} />
          {activeAirportField === 'origin' && <div className="airport-suggestions" id="origin-suggestions" role="listbox">{airportSuggestions(originQuery).map((airport) => <button type="button" role="option" key={airport.code} onMouseDown={(event) => event.preventDefault()} onClick={() => selectAirport('origin', airport)}><strong>{airport.code}</strong><span><b>{airport.city}</b>{airport.name}<small>{airport.region}</small></span></button>)}{airportSuggestions(originQuery).length === 0 && <p>No matching airports</p>}</div>}
          {formErrors.origin && <p className="field-error">{formErrors.origin}</p>}
        </div>
        <div className="airport-field"><label htmlFor="destination-airport">To</label><input id="destination-airport" role="combobox" aria-expanded={activeAirportField === 'destination'} aria-controls="destination-suggestions" aria-invalid={Boolean(formErrors.destination)} autoComplete="off" value={destinationQuery} onFocus={() => setActiveAirportField('destination')} onChange={(event) => { setDestinationQuery(event.target.value); setActiveAirportField('destination'); setFormErrors((errors) => ({ ...errors, destination: '' })) }} />
          {activeAirportField === 'destination' && <div className="airport-suggestions" id="destination-suggestions" role="listbox">{airportSuggestions(destinationQuery).map((airport) => <button type="button" role="option" key={airport.code} onMouseDown={(event) => event.preventDefault()} onClick={() => selectAirport('destination', airport)}><strong>{airport.code}</strong><span><b>{airport.city}</b>{airport.name}<small>{airport.region}</small></span></button>)}{airportSuggestions(destinationQuery).length === 0 && <p>No matching airports</p>}</div>}
          {formErrors.destination && <p className="field-error">{formErrors.destination}</p>}
        </div>
        <div className="date-picker-field"><span className="field-label">Dates</span><button className="calendar-trigger" type="button" aria-expanded={calendarOpen} onClick={() => { setCalendarOpen((open) => !open); setDateSelectionStep('depart') }}><span><small>Depart</small>{departDate}</span><b>→</b><span><small>Return</small>{returnDate}</span></button>
          {calendarOpen && <div className="calendar-popover" role="dialog" aria-label="Choose travel dates"><div className="calendar-instruction">{dateSelectionStep === 'depart' ? 'Select departure date' : 'Now select return date'}</div><div className="calendar-months">{[[2026, 10], [2026, 11]].map(([year, month]) => <section className="calendar-month" key={`${year}-${month}`}><h4>{monthLabels[month]} {year}</h4><div className="calendar-weekdays">{weekdayLabels.map((day) => <span key={day}>{day}</span>)}</div><div className="calendar-days">{calendarCells(year, month).map((day, index) => day === null ? <span key={`blank-${index}`} /> : (() => { const value = toDateValue(year, month, day); const selectedDate = value === departDate || value === returnDate; const inRange = value > departDate && value < returnDate; const disabled = value < '2026-11-19'; return <button type="button" key={value} disabled={disabled} className={`${selectedDate ? 'selected-date' : ''} ${inRange ? 'in-range' : ''}`} aria-label={value} onClick={() => selectCalendarDate(value)}>{day}</button> })())}</div></section>)}</div></div>}
          {formErrors.dates && <p className="field-error">{formErrors.dates}</p>}
        </div>
        <div className="search-actions"><p>Search uses sample availability for this prototype.</p><button className="submit-search" type="button" disabled={searchStatus === 'loading'} onClick={runSearch}>{searchStatus === 'loading' ? 'Searching flights…' : 'Search flights'}</button></div>
      </section>}

      <section className={`workspace ${searchStatus !== 'success' ? 'single' : ''}`} id="flights">
        <div className="results-pane">
          <div className="results-heading"><div><h1>Flights to HND</h1><p>San Francisco (SFO) → Tokyo Haneda (HND) <span>·</span> Tue, Nov 24, 2026</p></div><div className="sort-tabs" role="tablist">{(['Recommended', 'Cheapest', 'Fastest'] as SortKey[]).map((key) => <button key={key} role="tab" aria-selected={sort === key} className={sort === key ? 'active' : ''} onClick={() => setSort(key)}>{key}</button>)}</div></div>
          {searchStatus === 'loading' && <div className="loading-state" role="status" aria-live="polite"><span className="loading-spinner" /><div><strong>Searching for the best flights…</strong><p>Checking schedules, travel time, and availability.</p></div></div>}
          {searchStatus === 'empty' && <div className="message-state" role="status"><span className="state-kicker">No results</span><h2>No flights found for this route</h2><p>Try nearby airports, different dates, or a broader destination.</p><button onClick={() => setSearchOpen(true)}>Change search</button></div>}
          {searchStatus === 'error' && <div className="message-state error-state" role="alert"><span className="state-kicker">Search unavailable</span><h2>We couldn't load flight results</h2><p>The flight service did not respond. Your search details are still saved.</p><button onClick={runSearch}>Try again</button></div>}
          {searchStatus === 'success' && <><p className="result-count">3 flights found, sorted by {sort.toLowerCase()}</p>
          <div className="flight-list">{orderedFlights.map((flight) => (
            <button key={flight.id} className={`flight-row ${selectedId === flight.id ? 'selected' : ''}`} onClick={() => { setSelectedId(flight.id); setChosen(false) }} aria-pressed={selectedId === flight.id}>
              <div className="airline-block">{flight.badge && <span className="recommendation">{flight.badge}</span>}<span className={`airline-mark ${flight.id}`}>{flight.airline.split(' ')[0]}</span><strong>{flight.airline}</strong><small>{flight.code}</small></div>
              <div className="time-block"><strong>{flight.departure}</strong><span>SFO</span></div>
              <div className="route-line"><span>{flight.duration}</span><div><i /><i /></div><small>{flight.stops}{flight.connection ? ` (${flight.connection})` : ''}</small></div>
              <div className="time-block"><strong>{flight.arrival}<sup>+1</sup></strong><span>HND</span></div>
              <div className="price-block"><strong>${flight.price.toLocaleString()}</strong><span>round trip</span></div>
            </button>
          ))}</div></>}
        </div>

        {searchStatus === 'success' && <aside className="detail-pane">
          <span className="eyebrow">Selected flight</span><h2>SFO → HND</h2><p className="detail-meta">Tue, Nov 24, 2026 <span>·</span> {selected.stops} <span>·</span> {selected.duration} total</p>
          <div className="detail-airline"><strong>{selected.airline}</strong><span>{selected.code}</span></div>
          <div className={`itinerary ${isNonstop ? 'nonstop' : ''}`}><div className="timeline"><i />{!isNonstop && <b />}<i /></div><div className="itinerary-content">
            <div className="leg"><div><strong>{selected.departure}</strong><span>SFO</span></div><div><strong>San Francisco (SFO)</strong><span>{selected.code.split('·')[0]} · Boeing 737-900ER · 2h 15m</span></div></div>
            {!isNonstop && <><div className="leg midpoint"><div><strong>12:35 PM</strong><span>{connectionAirport}</span></div><div><strong>{connectionCity} ({connectionAirport})</strong></div></div><div className="layover"><div><strong>{layoverDuration} layover in {connectionCity} ({connectionAirport})</strong><span>{selected.id === 'united' ? 'Continue in the same terminal' : 'Change from Terminal N to Terminal S'}</span></div></div></>}
            <div className="leg"><div><strong>{selected.arrival}<sup>+1</sup></strong><span>HND</span></div><div><strong>Tokyo Haneda (HND)</strong><span>{selected.code.split('·').slice(-1)[0]} · Boeing 787-9</span></div></div>
          </div></div>
          {!isNonstop && <><section className="connection-info"><h3>About your connection in {connectionAirport}</h3><div><strong>Terminal</strong><span>{selected.id === 'united' ? 'Your next flight departs from the same terminal.' : 'Change from Terminal N to Terminal S.'}</span></div><div><strong>How to transfer</strong><span>{selected.id === 'united' ? 'Follow international connections signs after arrival.' : 'A 10–15 minute walk via the central connector.'}</span></div><div><strong>Baggage</strong><span>Checked bags transfer automatically. No pickup needed.</span></div></section><div className="risk-note"><div><strong>Connection risk: {selected.id === 'united' ? 'Low' : 'Moderate'}</strong><p>A {layoverDuration} layover is usually enough at {connectionAirport}{selected.id === 'alaska' ? ', with less buffer than longer connections' : ''}.</p></div></div></>}
          <button className={`choose-button ${chosen ? 'success' : ''}`} onClick={() => setChosen(true)}>{chosen ? 'Flight selected' : <>Choose this flight — ${selected.price.toLocaleString()} round trip</>}</button>
        </aside>}
      </section>
    </main>
  )
}

export default App
