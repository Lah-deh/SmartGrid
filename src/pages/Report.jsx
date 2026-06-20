import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ShieldCheck, MapPin, Camera, CheckCircle2, Loader2, AlertCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'

const CATEGORIES = [
  { value: 'road_damage', label: 'Road damage / pothole', agency: 'LASEMA' },
  { value: 'flooding', label: 'Flooding', agency: 'LSWC' },
  { value: 'fire', label: 'Fire', agency: 'Lagos Fire Service' },
  { value: 'accident', label: 'Road accident', agency: 'FRSC' },
  { value: 'power_outage', label: 'Power outage', agency: 'EKEDC' },
  { value: 'other', label: 'Other', agency: 'LASG' },
]

const LGAS = ['Ikeja', 'Surulere', 'Lagos Island', 'Lekki', 'Yaba', 'Apapa', 'Mushin', 'Oshodi', 'Victoria Island']

export default function Report() {
  const [step, setStep] = useState(1)
  const [category, setCategory] = useState('')
  const [severity, setSeverity] = useState('')
  const [description, setDescription] = useState('')
  const [photo, setPhoto] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [lga, setLga] = useState('')
  const [address, setAddress] = useState('')
  const [coords, setCoords] = useState(null)
  const [gpsStatus, setGpsStatus] = useState('idle')
  const [phone, setPhone] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [trackingId, setTrackingId] = useState(null)

  const handlePhotoChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setPhoto(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  const captureGPS = () => {
    setGpsStatus('loading')
    if (!navigator.geolocation) {
      setGpsStatus('denied')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setGpsStatus('done')
      },
      () => setGpsStatus('denied'),
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const canProceedStep1 = category && severity && description.length > 5 && photo
  const canProceedStep2 = lga && address && coords

  const handleSubmit = async () => {
    setSubmitting(true)
    setError('')
    try {
      const fileExt = photo.name.split('.').pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`
      const { error: uploadError } = await supabase.storage
        .from('incident-photos')
        .upload(fileName, photo)
      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage.from('incident-photos').getPublicUrl(fileName)
      const agency = CATEGORIES.find((c) => c.value === category)?.agency || 'LASG'

      const { data, error: insertError } = await supabase
        .from('incidents')
        .insert({
          category, severity, description, lga, address,
          lat: coords.lat, lng: coords.lng,
          media_url: urlData.publicUrl,
          status: 'open', source: 'citizen', agency,
          reporter_phone: phone || null,
        })
        .select()
        .single()

      if (insertError) throw insertError
      setTrackingId(data.id.slice(0, 8).toUpperCase())
      setStep(4)
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const fontStyles = (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
      .serif { font-family: 'Fraunces', serif; }
      .mono { font-family: 'JetBrains Mono', monospace; }
    `}</style>
  )

  if (step === 4) {
    return (
      <div className="min-h-screen bg-black text-[#F5F2EC] flex items-center justify-center px-6">
        {fontStyles}
        <div className="text-center max-w-sm">
          <CheckCircle2 size={36} className="text-[#a50e39] mx-auto mb-6" strokeWidth={1.8} />
          <h1 className="serif text-2xl mb-3">Report received</h1>
          <p className="text-[#8A867E] text-sm mb-2 leading-relaxed">
            Your tracking ID is
          </p>
          <p className="mono text-[#a50e39] text-lg font-medium mb-5">SG-{trackingId}</p>
          <p className="text-[#8A867E] text-sm mb-8 leading-relaxed">
            A responder will verify this shortly.{phone && " You'll get an SMS when the status changes."}
          </p>
          <Link
            to="/"
            className="inline-block border border-[#2A2826] text-sm px-6 py-3 rounded hover:border-[#4A4744] transition"
          >
            Back to home
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-[#F5F2EC]">
      {fontStyles}
      <nav className="flex items-center px-5 sm:px-8 py-5 sm:py-6">
        <Link to="/" className="flex items-center gap-2.5">
          <ShieldCheck size={20} className="text-[#a50e39]" strokeWidth={2.2} />
          <span className="serif text-base tracking-tight">SafeGrid</span>
        </Link>
      </nav>

      <div className="max-w-md mx-auto px-5 sm:px-6 py-8 sm:py-10">
        <div className="flex gap-1.5 mb-9">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-0.75 flex-1 rounded-full transition ${
                s <= step ? 'bg-[#a50e39]' : 'bg-[#1F1D1B]'
              }`}
            />
          ))}
        </div>

        {error && (
          <div className="flex items-start gap-2 bg-[#a50e39]/10 border border-[#a50e39]/25 text-[#e8576f] text-xs rounded p-3 mb-5">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        {step === 1 && (
          <div>
            <p className="mono text-[10px] tracking-[0.15em] text-[#a50e39] mb-2 uppercase">Step 1 of 3</p>
            <h1 className="serif text-2xl mb-7">What's happening?</h1>

            <label className="text-xs text-[#6B6862] mb-1.5 block">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-transparent border border-[#2A2826] rounded px-3 py-2.5 text-sm outline-none focus:border-[#a50e39] mb-5"
            >
              <option value="" className="bg-black">Select category...</option>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value} className="bg-black">{c.label}</option>
              ))}
            </select>

            <label className="text-xs text-[#6B6862] mb-1.5 block">Severity</label>
            <div className="grid grid-cols-4 gap-2 mb-5">
              {[
                { v: 'critical', label: 'Critical' },
                { v: 'high', label: 'High' },
                { v: 'medium', label: 'Medium' },
                { v: 'low', label: 'Low' },
              ].map((s) => (
                <button
                  key={s.v}
                  onClick={() => setSeverity(s.v)}
                  className={`py-2.5 rounded text-[11px] font-medium border transition ${
                    severity === s.v
                      ? 'border-[#a50e39] text-[#a50e39] bg-[#a50e39]/10'
                      : 'border-[#2A2826] text-[#6B6862]'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <label className="text-xs text-[#6B6862] mb-1.5 block">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Describe what you see..."
              className="w-full bg-transparent border border-[#2A2826] rounded px-3 py-2.5 text-sm outline-none focus:border-[#a50e39] mb-5 placeholder:text-[#4A4744]"
            />

            <label className="text-xs text-[#6B6862] mb-1.5 block">
              Photo evidence <span className="text-[#a50e39]">- required to verify</span>
            </label>
            <label className="flex items-center justify-center gap-2 border border-dashed border-[#2A2826] rounded py-6 cursor-pointer hover:border-[#a50e39]/50 transition mb-1">
              {photoPreview ? (
                <img src={photoPreview} alt="preview" className="h-20 rounded object-cover" />
              ) : (
                <div className="flex flex-col items-center gap-2 text-[#6B6862]">
                  <Camera size={18} />
                  <span className="text-xs">Tap to take or upload a photo</span>
                </div>
              )}
              <input type="file" accept="image/*" capture="environment" onChange={handlePhotoChange} className="hidden" />
            </label>
            <p className="text-[11px] text-[#4A4744] mb-7 leading-relaxed">
              Photos help responders confirm a report is real before it's escalated.
            </p>

            <button
              disabled={!canProceedStep1}
              onClick={() => setStep(2)}
              className="w-full bg-[#a50e39] text-[#F5F2EC] font-medium text-sm py-3 rounded hover:bg-[#8c0c30] transition disabled:opacity-25 disabled:cursor-not-allowed"
            >
              Next - location
            </button>
          </div>
        )}

        {step === 2 && (
          <div>
            <p className="mono text-[10px] tracking-[0.15em] text-[#a50e39] mb-2 uppercase">Step 2 of 3</p>
            <h1 className="serif text-2xl mb-7">Where is it?</h1>

            <label className="text-xs text-[#6B6862] mb-1.5 block">LGA / area</label>
            <select
              value={lga}
              onChange={(e) => setLga(e.target.value)}
              className="w-full bg-transparent border border-[#2A2826] rounded px-3 py-2.5 text-sm outline-none focus:border-[#a50e39] mb-5"
            >
              <option value="" className="bg-black">Select...</option>
              {LGAS.map((l) => <option key={l} className="bg-black">{l}</option>)}
            </select>

            <label className="text-xs text-[#6B6862] mb-1.5 block">Street / landmark</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Near Oshodi Overpass"
              className="w-full bg-transparent border border-[#2A2826] rounded px-3 py-2.5 text-sm outline-none focus:border-[#a50e39] mb-5 placeholder:text-[#4A4744]"
            />

            <label className="text-xs text-[#6B6862] mb-1.5 block">
              GPS location <span className="text-[#a50e39]">- required to verify</span>
            </label>
            <button
              onClick={captureGPS}
              className="w-full flex items-center justify-center gap-2 border border-[#2A2826] rounded py-3 text-sm mb-7 hover:border-[#a50e39]/50 transition"
            >
              {gpsStatus === 'loading' && <Loader2 size={14} className="animate-spin text-[#a50e39]" />}
              {gpsStatus === 'idle' && <MapPin size={14} className="text-[#6B6862]" />}
              {gpsStatus === 'done' && <CheckCircle2 size={14} className="text-[#a50e39]" />}
              {gpsStatus === 'denied' && <AlertCircle size={14} className="text-[#a50e39]" />}
              <span className={gpsStatus === 'done' ? 'text-[#a50e39]' : 'text-[#6B6862]'}>
                {gpsStatus === 'idle' && 'Capture my current location'}
                {gpsStatus === 'loading' && 'Getting your location...'}
                {gpsStatus === 'done' && `Captured (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})`}
                {gpsStatus === 'denied' && 'Location denied - enable and retry'}
              </span>
            </button>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="flex-1 border border-[#2A2826] text-sm py-3 rounded hover:border-[#4A4744] transition"
              >
                Back
              </button>
              <button
                disabled={!canProceedStep2}
                onClick={() => setStep(3)}
                className="flex-1 bg-[#a50e39] text-[#F5F2EC] font-medium text-sm py-3 rounded hover:bg-[#8c0c30] transition disabled:opacity-25 disabled:cursor-not-allowed"
              >
                Next - confirm
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <p className="mono text-[10px] tracking-[0.15em] text-[#a50e39] mb-2 uppercase">Step 3 of 3</p>
            <h1 className="serif text-2xl mb-7">Confirm & submit</h1>

            <div className="border border-[#1F1D1B] rounded-lg p-4 mb-6 space-y-3 text-sm">
              <Row label="Category" value={CATEGORIES.find((c) => c.value === category)?.label} />
              <Row label="Severity" value={severity[0].toUpperCase() + severity.slice(1)} />
              <Row label="Location" value={`${lga} -${address}`} />
              <Row label="Routes to" value={CATEGORIES.find((c) => c.value === category)?.agency} accent />
            </div>

            <label className="text-xs text-[#6B6862] mb-1.5 block">
              Your phone <span className="text-[#4A4744]">-optional, for status updates</span>
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+234 800 000 0000"
              className="w-full bg-transparent border border-[#2A2826] rounded px-3 py-2.5 text-sm outline-none focus:border-[#a50e39] mb-7 placeholder:text-[#4A4744]"
            />

            <div className="flex gap-3">
              <button
                onClick={() => setStep(2)}
                className="flex-1 border border-[#2A2826] text-sm py-3 rounded hover:border-[#4A4744] transition"
              >
                Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 bg-[#a50e39] text-[#F5F2EC] font-medium text-sm py-3 rounded hover:bg-[#8c0c30] transition disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Submit report'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Row({ label, value, accent }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-[#6B6862] text-xs">{label}</span>
      <span className={`font-medium text-sm ${accent ? 'text-[#a50e39]' : 'text-[#F5F2EC]'}`}>{value}</span>
    </div>
  )
}