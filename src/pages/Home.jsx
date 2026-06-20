import { Link } from 'react-router-dom'
import { AlertTriangle, MapPin, Zap, ShieldCheck, ArrowRight } from 'lucide-react'

export default function Home() {
  return (
    <div className="min-h-screen bg-black text-[#F5F2EC] font-[Inter]">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        .serif { font-family: 'Fraunces', serif; }
        .mono { font-family: 'JetBrains Mono', monospace; }
      `}</style>

      {/* NAV */}
      <nav className="flex items-center justify-between px-5 sm:px-8 md:px-14 py-5 sm:py-6">
        <Link to="/" className="flex items-center gap-2.5">
          <ShieldCheck size={22} className="text-[#a50e39] shrink-0" strokeWidth={2.2} />
          <span className="serif text-base sm:text-lg tracking-tight">SafeGrid</span>
        </Link>
        <div className="flex items-center gap-3 sm:gap-6">
          <Link
            to="/report"
            className="hidden sm:inline text-sm text-[#6B6862] hover:text-[#F5F2EC] transition"
          >
            Report an incident
          </Link>
          <Link
            to="/login"
            className="text-xs sm:text-sm font-medium bg-[#a50e39] text-[#F5F2EC] px-4 py-2 rounded hover:bg-[#8c0c30] transition whitespace-nowrap"
          >
            Responder login
          </Link>
        </div>
      </nav>

      
      <section className="relative px-5 sm:px-8 md:px-14 pt-10 sm:pt-16 md:pt-20 pb-16 sm:pb-24 max-w-7xl mx-auto overflow-hidden">
        <ShieldCheck
          size={420}
          strokeWidth={0.6}
          className="hidden lg:block absolute -right-16 top-0 text-[#a50e39]/[0.07] pointer-events-none"
        />
        <div className="relative max-w-2xl">
          
          <h1 className="serif text-4xl sm:text-5xl md:text-7xl leading-[1.05] mb-6 sm:mb-7 font-medium">
            A pothole reported<br />
            <span className="text-[#a50e39] italic">shouldn't disappear</span><br />
            into a group chat.
          </h1>
          <p className="text-[#9C9890] text-base sm:text-lg max-w-lg mb-8 sm:mb-10 leading-relaxed">
            SafeGrid gives every flood, fire and outage a verified path from a
            citizen's phone to the agency that can actually fix it and tells you
            what happened next.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              to="/report"
              className="flex items-center justify-center gap-2 bg-[#a50e39] text-[#F5F2EC] font-medium px-6 py-3.5 rounded hover:bg-[#8c0c30] transition text-sm"
            >
              Report an incident <ArrowRight size={15} />
            </Link>
            <Link
              to="/login"
              className="flex items-center justify-center gap-2 border border-[#2A2826] px-6 py-3.5 rounded hover:border-[#4A4744] transition text-sm text-[#F5F2EC]"
            >
              I'm a responder
            </Link>
          </div>
        </div>
      </section>

      {/* FEATURES — quieter, text-led, not icon-card grid */}
      <section className="px-5 sm:px-8 md:px-14 py-14 sm:py-20 max-w-5xl mx-auto">
        <div className="grid sm:grid-cols-3 gap-8 sm:gap-6">
          <Feature
            icon={<MapPin size={17} />}
            title="Verified by GPS"
            desc="Location and a photo are required on every report - no GPS, no photo, no submission."
          />
          <Feature
            icon={<ShieldCheck size={17} />}
            title="Confirmed by a person"
            desc="A responder checks each report before it's escalated to LASEMA, FRSC, or EKEDC."
          />
          <Feature
            icon={<Zap size={17} />}
            title="Caught by sensors"
            desc="ESP32 nodes at flood-prone points file a report the moment water crosses the line - before anyone calls it in."
          />
        </div>
      </section>

      {/* HOW IT WORKS — connected pipeline, not numbered cards */}
      <section className="px-5 sm:px-8 md:px-14 py-14 sm:py-20 max-w-3xl mx-auto">
        <h2 className="serif text-2xl sm:text-3xl mb-10 sm:mb-12">From report to resolved</h2>
        <div className="relative pl-7 sm:pl-9">
          <div className="absolute left-1.25 sm:left-1.75 top-2 bottom-2 w-px bg-linear-to-b from-[#a50e39] via-[#2A2826] to-[#2A2826]" />
          <PipeStep
            title="Someone sees it first"
            desc="Flooded road, downed line, fire - a citizen submits category, severity, a photo, and their exact location in under a minute."
          />
          <PipeStep
            title="The system checks for duplicates"
            desc="Reports clustered near the same spot within a short window get merged and treated as community-confirmed, automatically."
          />
          <PipeStep
            title="A responder verifies it"
            desc="No report reaches an emergency agency without a human confirming it's real - this is what keeps SafeGrid trustworthy."
          />
          <PipeStep
            title="It's routed and tracked"
            desc="Verified incidents go straight to the right agency by category. The reporter gets updated as it moves toward resolved."
            last
          />
        </div>
      </section>

      {/* CTA */}
      <section className="px-5 sm:px-8 md:px-14 py-16 sm:py-24 max-w-3xl mx-auto text-center">
        <AlertTriangle size={22} className="text-[#a50e39] mx-auto mb-5" strokeWidth={1.8} />
        <h3 className="serif text-2xl sm:text-3xl mb-3">Seen something today?</h3>
        <p className="text-[#9C9890] mb-8 max-w-sm mx-auto text-sm sm:text-base">
          It takes less time to report than it does to type it into a group chat.
        </p>
        <Link
          to="/report"
          className="inline-flex items-center gap-2 bg-[#a50e39] text-[#F5F2EC] font-medium px-7 py-3.5 rounded hover:bg-[#8c0c30] transition text-sm"
        >
          Report an incident <ArrowRight size={15} />
        </Link>
      </section>

      
    </div>
  )
}

function Feature({ icon, title, desc }) {
  return (
    <div>
      <div className="text-[#a50e39] mb-3">{icon}</div>
      <h3 className="font-semibold text-sm mb-1.5">{title}</h3>
      <p className="text-[#8A867E] text-sm leading-relaxed">{desc}</p>
    </div>
  )
}

function PipeStep({ title, desc, last }) {
  return (
    <div className={`relative ${last ? '' : 'pb-9 sm:pb-10'}`}>
      <div className="absolute -left-7 sm:-left-9 top-1 w-2.5 h-2.5 rounded-full bg-[#a50e39] ring-4 ring-black" />
      <h4 className="font-semibold text-sm sm:text-base mb-1.5">{title}</h4>
      <p className="text-[#8A867E] text-sm leading-relaxed max-w-md">{desc}</p>
    </div>
  )
}