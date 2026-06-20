import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ShieldCheck, AlertCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const navigate = useNavigate()
  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [lga, setLga] = useState('')
  const [accessCode, setAccessCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    navigate('/dashboard')
  }

  const handleSignup = async (e) => {
    e.preventDefault()
    setError('')

    if (accessCode.trim() !== import.meta.env.VITE_RESPONDER_ACCESS_CODE) {
      setError('Invalid agency access code. Contact your SafeGrid coordinator for the correct code.')
      return
    }

    setLoading(true)

    const { data, error: signUpError } = await supabase.auth.signUp({ email, password })
    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    // If email confirmation is required, Supabase returns no session yet —
    // auth.uid() will be null and the profile insert will fail RLS.
    if (!data.session) {
      setError(
        'Account created, check your email to confirm, then log in. ' +
        '(Or ask the project owner to disable email confirmation for testing.)'
      )
      setLoading(false)
      return
    }

    const { error: profileError } = await supabase.from('users').insert({
      id: data.user.id,
      role: 'responder',
      name,
      lga,
    })

    if (profileError) {
      setError(profileError.message)
      setLoading(false)
      return
    }

    navigate('/dashboard')
  }

  return (
    <div className="min-h-screen bg-black text-[#F5F2EC] flex items-center justify-center px-5 sm:px-6">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500&family=Inter:wght@400;500;600&display=swap');
        .serif { font-family: 'Fraunces', serif; }
      `}</style>

      <div className="w-full max-w-sm">
        <Link to="/" className="flex items-center gap-2.5 justify-center mb-9">
          <ShieldCheck size={22} className="text-[#a50e39]" strokeWidth={2.2} />
          <span className="serif text-lg tracking-tight">SafeGrid</span>
        </Link>

        <div className="mb-7">
          <h1 className="serif text-2xl mb-1.5">
            {mode === 'login' ? 'Welcome back' : 'Join as a responder'}
          </h1>
          <p className="text-[#8A867E] text-sm leading-relaxed">
            {mode === 'login'
              ? "Sign in to see what's come in across your LGA."
              : 'For LGA staff and emergency response teams handling live incidents.'}
          </p>
        </div>

        <div className="flex gap-5 mb-7 text-sm border-b border-[#1F1D1B]">
          <button
            onClick={() => { setMode('login'); setError('') }}
            className={`pb-3 -mb-px border-b-2 transition ${
              mode === 'login' ? 'border-[#a50e39] text-[#F5F2EC]' : 'border-transparent text-[#6B6862]'
            }`}
          >
            Log in
          </button>
          <button
            onClick={() => { setMode('signup'); setError('') }}
            className={`pb-3 -mb-px border-b-2 transition ${
              mode === 'signup' ? 'border-[#a50e39] text-[#F5F2EC]' : 'border-transparent text-[#6B6862]'
            }`}
          >
            Sign up
          </button>
        </div>

        {error && (
          <div className="flex items-start gap-2 bg-[#a50e39]/10 border border-[#a50e39]/25 text-[#e8576f] text-xs rounded p-3 mb-5">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        <form onSubmit={mode === 'login' ? handleLogin : handleSignup} className="space-y-4">
          {mode === 'signup' && (
            <>
              <Field label="Full name" value={name} onChange={setName} placeholder="Adaeze Okafor" />
              <Field label="Agency access code" value={accessCode} onChange={setAccessCode} placeholder="Issued by your coordinator" type="password" />
              <div>
                <label className="text-xs text-[#6B6862] mb-1.5 block">LGA or agency</label>
                <select
                  value={lga}
                  onChange={(e) => setLga(e.target.value)}
                  required
                  className="w-full bg-transparent border border-[#2A2826] rounded px-3 py-2.5 text-sm outline-none focus:border-[#a50e39] transition text-[#F5F2EC]"
                >
                  <option value="" className="bg-black">Select...</option>
                  {['Ikeja', 'Surulere', 'Lagos Island', 'Lekki', 'Yaba', 'Apapa', 'Mushin', 'Oshodi', 'Victoria Island'].map((l) => (
                    <option key={l} value={l} className="bg-black">{l}</option>
                  ))}
                </select>
              </div>
            </>
          )}
          <Field label="Email" value={email} onChange={setEmail} placeholder="you@agency.gov.ng" type="email" />
          <Field label="Password" value={password} onChange={setPassword} placeholder="••••••••" type="password" />

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#a50e39] text-[#F5F2EC] font-medium text-sm py-3 rounded hover:bg-[#8c0c30] transition disabled:opacity-50 mt-1"
          >
            {loading ? 'One moment...' : mode === 'login' ? 'Log in' : 'Create account'}
          </button>
        </form>

        <p className="text-center text-[#4A4744] text-xs mt-7">
          Reporting an incident?{' '}
          <Link to="/report" className="text-[#a50e39] hover:underline">
            No account needed
          </Link>
        </p>
      </div>
    </div>
  )
}

function Field({ label, value, onChange, placeholder, type = 'text' }) {
  return (
    <div>
      <label className="text-xs text-[#6B6862] mb-1.5 block">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required
        className="w-full bg-transparent border border-[#2A2826] rounded px-3 py-2.5 text-sm outline-none focus:border-[#a50e39] transition placeholder:text-[#4A4744] text-[#F5F2EC]"
      />
    </div>
  )
}