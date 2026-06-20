import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ShieldCheck, LogOut, MapPin, Clock, CheckCircle2,
  AlertCircle, Filter, ChevronRight, Loader2, List, Map as MapIcon
} from 'lucide-react'
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { supabase } from '../lib/supabase'

const SEVERITY_COLOR = {
  critical: '#a50e39',
  high: '#c2742f',
  medium: '#3b6ea5',
  low: '#3a8c5f',
}

const STATUS_LABEL = {
  open: 'Open',
  in_progress: 'In progress',
  escalated: 'Escalated',
  resolved: 'Resolved',
}

export default function Dashboard({ session }) {
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [incidents, setIncidents] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterSeverity, setFilterSeverity] = useState('all')
  const [selected, setSelected] = useState(null)
  const [updating, setUpdating] = useState(false)
  const [view, setView] = useState('list') // 'list' | 'map'
  const [page, setPage] = useState('incidents') // 'incidents' | 'sensors'
  const [sensors, setSensors] = useState([])
  const [simulating, setSimulating] = useState(null)

  // Load responder profile
  useEffect(() => {
    const loadProfile = async () => {
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single()
      setProfile(data)
    }
    loadProfile()
  }, [session])

  // Load incidents + subscribe to realtime changes
  useEffect(() => {
    const loadIncidents = async () => {
      const { data, error } = await supabase
        .from('incidents')
        .select('*')
        .order('created_at', { ascending: false })
      if (!error) setIncidents(data || [])
      setLoading(false)
    }
    loadIncidents()

    const channel = supabase
      .channel('incidents-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'incidents' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setIncidents((prev) => [payload.new, ...prev])
          } else if (payload.eventType === 'UPDATE') {
            setIncidents((prev) =>
              prev.map((i) => (i.id === payload.new.id ? payload.new : i))
            )
          }
        }
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [])

  // Load sensors + subscribe to realtime changes
  useEffect(() => {
    const loadSensors = async () => {
      const { data, error } = await supabase
        .from('sensors')
        .select('*')
        .order('node_name')
      if (!error) setSensors(data || [])
    }
    loadSensors()

    const sensorChannel = supabase
      .channel('sensors-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sensors' },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            setSensors((prev) =>
              prev.map((s) => (s.id === payload.new.id ? payload.new : s))
            )
          }
        }
      )
      .subscribe()

    return () => supabase.removeChannel(sensorChannel)
  }, [])

  // Simulate an ESP32 sensor crossing its threshold and auto-filing an incident
  const simulateTrigger = async (sensor) => {
    setSimulating(sensor.id)

    const triggeredValue =
      sensor.type === 'power'
        ? Math.round(sensor.threshold - 30) // voltage drop = below threshold
        : Math.round(sensor.threshold + 15) // everything else = above threshold

    // 1. Update the sensor's last reading + status, as the real ESP32 firmware would via HTTP POST
    await supabase
      .from('sensors')
      .update({ last_reading: triggeredValue, status: 'alert', last_ping: new Date().toISOString() })
      .eq('id', sensor.id)

    // 2. Auto-generate the structured incident, exactly like the Cloud Function/Edge Function would
    const categoryMap = { flood: 'flooding', smoke: 'fire', traffic: 'accident', power: 'power_outage' }
    const agencyMap = { flood: 'LSWC', smoke: 'Lagos Fire Service', traffic: 'FRSC', power: 'EKEDC' }

    await supabase.from('incidents').insert({
      category: categoryMap[sensor.type],
      severity: 'critical',
      description: `Auto-detected by ${sensor.node_name}: reading ${triggeredValue} crossed threshold ${sensor.threshold}.`,
      lga: sensor.lga,
      address: sensor.landmark,
      lat: sensor.lat,
      lng: sensor.lng,
      status: 'open',
      source: 'iot_sensor',
      sensor_id: sensor.id,
      agency: agencyMap[sensor.type],
    })

    setTimeout(() => setSimulating(null), 1200)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  const updateStatus = async (incident, newStatus) => {
    setUpdating(true)
    const oldStatus = incident.status

    const { error: updateError } = await supabase
      .from('incidents')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', incident.id)

    if (!updateError) {
      await supabase.from('status_logs').insert({
        incident_id: incident.id,
        changed_by: session.user.id,
        old_status: oldStatus,
        new_status: newStatus,
      })
      setSelected((prev) => prev && { ...prev, status: newStatus })
    }
    setUpdating(false)
  }

  const filtered = incidents.filter((i) => {
    if (filterStatus !== 'all' && i.status !== filterStatus) return false
    if (filterSeverity !== 'all' && i.severity !== filterSeverity) return false
    return true
  })

  const counts = {
    open: incidents.filter((i) => i.status === 'open').length,
    in_progress: incidents.filter((i) => i.status === 'in_progress').length,
    resolved: incidents.filter((i) => i.status === 'resolved').length,
  }

  return (
    <div className="min-h-screen bg-black text-[#F5F2EC]">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
        .serif { font-family: 'Fraunces', serif; }
        .mono { font-family: 'JetBrains Mono', monospace; }
      `}</style>

      {/* NAV */}
      <nav className="flex items-center justify-between px-5 sm:px-8 py-4 sm:py-5 border-b border-[#1F1D1B]">
        <div className="flex items-center gap-6 sm:gap-8">
          <div className="flex items-center gap-2.5">
            <ShieldCheck size={20} className="text-[#a50e39]" strokeWidth={2.2} />
            <span className="serif text-base tracking-tight">SafeGrid</span>
          </div>
          <div className="hidden sm:flex items-center gap-5 text-sm">
            <button
              onClick={() => setPage('incidents')}
              className={page === 'incidents' ? 'text-[#F5F2EC]' : 'text-[#6B6862] hover:text-[#8A867E] transition'}
            >
              Incidents
            </button>
            <button
              onClick={() => setPage('sensors')}
              className={page === 'sensors' ? 'text-[#F5F2EC]' : 'text-[#6B6862] hover:text-[#8A867E] transition'}
            >
              IoT Sensors
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3 sm:gap-5">
          {profile && (
            <span className="hidden sm:block text-xs text-[#6B6862]">
              {profile.name} · {profile.lga}
            </span>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-xs text-[#6B6862] hover:text-[#F5F2EC] transition"
          >
            <LogOut size={14} /> Log out
          </button>
        </div>
      </nav>

      {/* mobile page tabs */}
      <div className="flex sm:hidden gap-5 px-5 py-3 text-sm border-b border-[#1F1D1B]">
        <button
          onClick={() => setPage('incidents')}
          className={page === 'incidents' ? 'text-[#F5F2EC]' : 'text-[#6B6862]'}
        >
          Incidents
        </button>
        <button
          onClick={() => setPage('sensors')}
          className={page === 'sensors' ? 'text-[#F5F2EC]' : 'text-[#6B6862]'}
        >
          IoT Sensors
        </button>
      </div>

      {page === 'sensors' ? (
        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-6 sm:py-8">
          <div className="mb-7">
            <h1 className="serif text-2xl sm:text-3xl mb-1">IoT sensor network</h1>
            <p className="text-[#6B6862] text-sm">
              {sensors.length} ESP32 nodes deployed across Lagos LGAs
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {sensors.map((sensor) => (
              <div key={sensor.id} className="border border-[#1F1D1B] rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="mono text-[10px] tracking-wide text-[#6B6862] uppercase">
                    {sensor.type}
                  </span>
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      sensor.status === 'alert' ? 'bg-[#a50e39] animate-pulse' :
                      sensor.status === 'online' ? 'bg-[#3a8c5f]' : 'bg-[#4A4744]'
                    }`}
                  />
                </div>
                <h3 className="font-medium text-sm mb-1">{sensor.node_name}</h3>
                <p className="text-[#6B6862] text-xs mb-4">{sensor.landmark}, {sensor.lga}</p>

                <div className="flex items-end justify-between mb-1">
                  <span className="mono text-2xl font-medium" style={{
                    color: sensor.status === 'alert' ? '#a50e39' : '#8A867E'
                  }}>
                    {sensor.last_reading}
                  </span>
                  <span className="text-[10px] text-[#4A4744] mb-1">
                    threshold {sensor.threshold}
                  </span>
                </div>
                <div className="h-1 bg-[#1F1D1B] rounded-full mb-4 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, (sensor.last_reading / sensor.threshold) * 100)}%`,
                      background: sensor.status === 'alert' ? '#a50e39' : '#3a8c5f',
                    }}
                  />
                </div>

                <button
                  onClick={() => simulateTrigger(sensor)}
                  disabled={simulating === sensor.id}
                  className="w-full text-xs py-2 rounded border border-[#2A2826] text-[#8A867E] hover:border-[#a50e39]/50 hover:text-[#a50e39] transition disabled:opacity-50"
                >
                  {simulating === sensor.id ? 'Triggering...' : 'Simulate threshold breach'}
                </button>
              </div>
            ))}
            {sensors.length === 0 && (
              <p className="text-[#4A4744] text-sm col-span-full text-center py-12">
                No sensors found - run the seed SQL to add demo nodes.
              </p>
            )}
          </div>

          <p className="text-[#4A4744] text-xs mt-6 max-w-2xl leading-relaxed">
            "Simulate" mimics what an ESP32 node does in the field: it crosses its threshold,
            posts a reading to the backend, and the system auto-files a verified incident —
            no citizen report required. Switch to the Incidents tab to see it appear.
          </p>
        </div>
      ) : (
      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-6 sm:py-8">
        {/* HEADER + STATS */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-7">
          <div>
            <h1 className="serif text-2xl sm:text-3xl mb-1">Live incidents</h1>
            <p className="text-[#6B6862] text-sm">
              {loading ? 'Loading...' : `${filtered.length} showing of ${incidents.length} total`}
            </p>
          </div>
          <div className="flex gap-4 sm:gap-6">
            <Stat label="Open" value={counts.open} color="#a50e39" />
            <Stat label="In progress" value={counts.in_progress} color="#c2742f" />
            <Stat label="Resolved" value={counts.resolved} color="#3a8c5f" />
          </div>
        </div>

        {/* FILTERS + VIEW TOGGLE */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="flex flex-wrap items-center gap-2">
            <Filter size={13} className="text-[#4A4744] mr-1" />
            {['all', 'open', 'in_progress', 'escalated', 'resolved'].map((s) => (
              <FilterPill
                key={s}
                active={filterStatus === s}
                onClick={() => setFilterStatus(s)}
                label={s === 'all' ? 'All status' : STATUS_LABEL[s]}
              />
            ))}
            <span className="w-px h-4 bg-[#2A2826] mx-1 hidden sm:block" />
            {['all', 'critical', 'high', 'medium', 'low'].map((s) => (
              <FilterPill
                key={s}
                active={filterSeverity === s}
                onClick={() => setFilterSeverity(s)}
                label={s === 'all' ? 'All severity' : s[0].toUpperCase() + s.slice(1)}
                dot={s !== 'all' ? SEVERITY_COLOR[s] : null}
              />
            ))}
          </div>
          <div className="flex gap-1 border border-[#2A2826] rounded-lg p-1">
            <button
              onClick={() => setView('list')}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded transition ${
                view === 'list' ? 'bg-[#a50e39]/15 text-[#a50e39]' : 'text-[#6B6862]'
              }`}
            >
              <List size={13} /> List
            </button>
            <button
              onClick={() => setView('map')}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded transition ${
                view === 'map' ? 'bg-[#a50e39]/15 text-[#a50e39]' : 'text-[#6B6862]'
              }`}
            >
              <MapIcon size={13} /> Map
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-[1fr_380px] gap-6">
          {/* INCIDENT LIST OR MAP */}
          {view === 'list' ? (
          <div className="space-y-2">
            {loading && (
              <div className="flex items-center justify-center py-20 text-[#6B6862]">
                <Loader2 size={18} className="animate-spin mr-2" /> Loading incidents...
              </div>
            )}
            {!loading && filtered.length === 0 && (
              <div className="text-center py-20 text-[#4A4744] text-sm">
                No incidents match these filters.
              </div>
            )}
            {filtered.map((incident) => (
              <button
                key={incident.id}
                onClick={() => setSelected(incident)}
                className={`w-full text-left flex items-center gap-3 sm:gap-4 p-3.5 sm:p-4 rounded-lg border transition ${
                  selected?.id === incident.id
                    ? 'border-[#a50e39]/50 bg-[#a50e39]/[0.04]'
                    : 'border-[#1F1D1B] hover:border-[#2A2826]'
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: SEVERITY_COLOR[incident.severity] }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {CATEGORY_LABEL[incident.category] || incident.category} -{incident.lga}
                  </p>
                  <p className="text-[#6B6862] text-xs mono mt-0.5">
                    {timeAgo(incident.created_at)} · {incident.agency}
                  </p>
                </div>
                <StatusBadge status={incident.status} />
                <ChevronRight size={15} className="text-[#4A4744] hidden sm:block shrink-0" />
              </button>
            ))}
          </div>
          ) : (
          <div className="rounded-lg overflow-hidden border border-[#1F1D1B]" style={{ height: 560 }}>
            <MapContainer
              center={[6.5244, 3.3792]}
              zoom={11}
              style={{ height: '100%', width: '100%', background: '#0a0a0a' }}
            >
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                attribution='&copy; OpenStreetMap &copy; CARTO'
              />
              {filtered.filter((i) => i.lat && i.lng).map((incident) => (
                <CircleMarker
                  key={incident.id}
                  center={[incident.lat, incident.lng]}
                  radius={selected?.id === incident.id ? 11 : 8}
                  pathOptions={{
                    color: SEVERITY_COLOR[incident.severity],
                    fillColor: SEVERITY_COLOR[incident.severity],
                    fillOpacity: 0.7,
                    weight: selected?.id === incident.id ? 3 : 1.5,
                  }}
                  eventHandlers={{ click: () => setSelected(incident) }}
                >
                  <Popup>
                    <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 12 }}>
                      <strong>{CATEGORY_LABEL[incident.category] || incident.category}</strong>
                      <br />
                      {incident.lga} - {STATUS_LABEL[incident.status]}
                    </div>
                  </Popup>
                </CircleMarker>
              ))}
            </MapContainer>
          </div>
          )}

          {/* DETAIL PANEL */}
          <div className="lg:sticky lg:top-6 h-fit">
            {!selected ? (
              <div className="border border-[#1F1D1B] rounded-lg p-8 text-center text-[#4A4744] text-sm">
                Select an incident to view details
              </div>
            ) : (
              <div className="border border-[#1F1D1B] rounded-lg overflow-hidden">
                {selected.media_url && (
                  <img
                    src={selected.media_url}
                    alt="Incident evidence"
                    className="w-full h-44 object-cover"
                  />
                )}
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span
                      className="text-[10px] font-medium px-2 py-0.5 rounded uppercase tracking-wide"
                      style={{
                        color: SEVERITY_COLOR[selected.severity],
                        background: `${SEVERITY_COLOR[selected.severity]}1A`,
                      }}
                    >
                      {selected.severity}
                    </span>
                    <StatusBadge status={selected.status} />
                  </div>

                  <h3 className="serif text-lg mb-1">
                    {CATEGORY_LABEL[selected.category] || selected.category}
                  </h3>
                  <p className="text-[#8A867E] text-sm mb-4 leading-relaxed">
                    {selected.description}
                  </p>

                  <div className="space-y-2 mb-5 text-xs">
                    <DetailRow icon={<MapPin size={13} />} text={`${selected.lga} - ${selected.address}`} />
                    <DetailRow icon={<Clock size={13} />} text={timeAgo(selected.created_at)} />
                    <DetailRow icon={<ShieldCheck size={13} />} text={`Routed to ${selected.agency}`} />
                    {selected.reporter_phone && (
                      <DetailRow icon={<AlertCircle size={13} />} text={selected.reporter_phone} />
                    )}
                  </div>

                  <div className="border-t border-[#1F1D1B] pt-4">
                    <p className="text-xs text-[#6B6862] mb-3">Update status</p>
                    <div className="grid grid-cols-2 gap-2">
                      {['open', 'in_progress', 'escalated', 'resolved'].map((s) => (
                        <button
                          key={s}
                          disabled={updating || selected.status === s}
                          onClick={() => updateStatus(selected, s)}
                          className={`text-xs py-2 rounded border transition ${
                            selected.status === s
                              ? 'border-[#a50e39] bg-[#a50e39]/10 text-[#a50e39]'
                              : 'border-[#2A2826] text-[#8A867E] hover:border-[#4A4744]'
                          } disabled:cursor-default`}
                        >
                          {STATUS_LABEL[s]}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      )}
    </div>
  )
}

const CATEGORY_LABEL = {
  road_damage: 'Road damage',
  flooding: 'Flooding',
  fire: 'Fire',
  accident: 'Road accident',
  power_outage: 'Power outage',
  other: 'Other',
}

function Stat({ label, value, color }) {
  return (
    <div>
      <p className="mono text-xl sm:text-2xl font-medium" style={{ color }}>{value}</p>
      <p className="text-[10px] text-[#6B6862] uppercase tracking-wide">{label}</p>
    </div>
  )
}

function FilterPill({ active, onClick, label, dot }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition ${
        active
          ? 'border-[#a50e39] text-[#a50e39] bg-[#a50e39]/10'
          : 'border-[#2A2826] text-[#6B6862] hover:border-[#4A4744]'
      }`}
    >
      {dot && <span className="w-1.5 h-1.5 rounded-full" style={{ background: dot }} />}
      {label}
    </button>
  )
}

function StatusBadge({ status }) {
  const colors = {
    open: '#a50e39',
    in_progress: '#c2742f',
    escalated: '#3b6ea5',
    resolved: '#3a8c5f',
  }
  return (
    <span
      className="text-[10px] font-medium px-2 py-1 rounded uppercase tracking-wide shrink-0"
      style={{ color: colors[status], background: `${colors[status]}1A` }}
    >
      {STATUS_LABEL[status]}
    </span>
  )
}

function DetailRow({ icon, text }) {
  return (
    <div className="flex items-center gap-2 text-[#8A867E]">
      <span className="text-[#4A4744]">{icon}</span>
      {text}
    </div>
  )
}

function timeAgo(timestamp) {
  const diff = Math.floor((Date.now() - new Date(timestamp)) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}