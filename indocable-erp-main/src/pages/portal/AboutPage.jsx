import { useNavigate } from 'react-router-dom'
import {
  Award, CheckCircle2, Layers, TrendingUp, Factory,
  Phone, Mail, MessageCircle, MapPin, ArrowRight, Shield, Zap,
} from 'lucide-react'

const STATS = [
  { value: '25+',    label: 'Years of Excellence',       color: 'text-brand-500' },
  { value: '6',      label: 'Product Categories',        color: 'text-blue-500'  },
  { value: 'ISI',    label: 'BIS / ISI Certified',       color: 'text-emerald-500' },
  { value: 'CPRI',   label: 'Type Tested at CPRI',       color: 'text-purple-500' },
]

const CERTS = [
  { name: 'IS 694:2010',       desc: 'PVC insulated cables & wires for electrical installations', color: 'bg-orange-50 border-orange-200 text-orange-700' },
  { name: 'IS 1554 Part I',    desc: 'PVC insulated (heavy duty) electric cables — up to 1.1kV', color: 'bg-blue-50 border-blue-200 text-blue-700' },
  { name: 'IS 7098 Part I',    desc: 'XLPE insulated cables for working voltages up to 1.1kV',   color: 'bg-purple-50 border-purple-200 text-purple-700' },
  { name: 'BIS / ISI Mark',    desc: 'Bureau of Indian Standards certification on all products',  color: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
  { name: 'CPRI Tested',       desc: 'Central Power Research Institute type-tested samples',      color: 'bg-amber-50 border-amber-200 text-amber-700' },
  { name: 'RoHS Compliant',    desc: 'Restriction of Hazardous Substances in all product lines', color: 'bg-teal-50 border-teal-200 text-teal-700' },
]

const PRODUCTS = [
  { icon: Shield,    title: 'Housing Wires',           desc: 'FR, FRLS, ZHFR wires for buildings and panels' },
  { icon: Zap,       title: 'Flexible Cables',         desc: 'Multi-strand cables for appliances and equipment' },
  { icon: Layers,    title: 'Armoured Cables',         desc: 'SWA/AWA cables for outdoor and industrial use' },
  { icon: Award,     title: 'XLPE Power Cables',       desc: '1.1kV XLPE insulated power distribution cables' },
  { icon: Factory,   title: 'Submersible Cables',      desc: 'Waterproof cables for pump installations' },
  { icon: TrendingUp,'title': 'Instrumentation Cables','desc': 'Screened and shielded signal cables' },
]

const WHY_US = [
  {
    title:  'Manufacturing Expertise',
    points: ['State-of-the-art extrusion and stranding machinery', 'In-house copper rod breakdown lines', 'Full BOM traceability from raw material to final product'],
  },
  {
    title:  'Quality Assurance',
    points: ['Inline spark testing on every metre of cable', 'CPRI type tested for each product category', 'ISI mark on all applicable products'],
  },
  {
    title:  'Supply Capability',
    points: ['Complete range from 0.5 sq mm to 240 sq mm', 'Both copper and aluminium conductors', 'Standard and custom drum lengths available'],
  },
]

export default function AboutPage() {
  const navigate = useNavigate()

  return (
    <div>
      {/* ── Hero ── */}
      <section
        className="relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0b1120 0%, #0f1a0a 50%, #1a0500 100%)' }}
      >
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: 'radial-gradient(circle, #f97316 1px, transparent 1px)', backgroundSize: '32px 32px' }}
        />
        <div className="relative max-w-7xl mx-auto px-4 md:px-7 py-20">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-white/10 bg-white/5 text-xs text-amber-300 font-semibold mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              About Indocable · Mica Group
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-white leading-tight mb-5 tracking-tight">
              25+ Years of<br />
              <span
                className="text-transparent bg-clip-text"
                style={{ backgroundImage: 'linear-gradient(90deg, #f97316, #fbbf24)' }}
              >
                Manufacturing Excellence
              </span>
            </h1>
            <p className="text-lg text-slate-300 leading-relaxed">
              Indocable by Mica Group is a leading cable manufacturer based in Bangalore, India.
              We manufacture ISI-certified cables trusted by contractors, builders, and
              industrial buyers across India.
            </p>
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 md:px-7 py-10 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {STATS.map(s => (
            <div key={s.label}>
              <div className={`text-4xl font-black ${s.color} mb-1`}>{s.value}</div>
              <div className="text-sm text-gray-500 font-medium">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Our Story ── */}
      <section className="max-w-7xl mx-auto px-4 md:px-7 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-3xl font-black text-gray-900 tracking-tight mb-5">
              Built on a Foundation of Quality
            </h2>
            <div className="space-y-4 text-gray-600 leading-relaxed">
              <p>
                Indocable is part of the Mica Group, a trusted name in the electrical industry with
                over 25 years of experience in cable manufacturing. Our factory in Bangalore is
                equipped with modern extrusion, stranding, and armoring lines to produce cables
                that meet and exceed Indian standards.
              </p>
              <p>
                Every cable that leaves our factory undergoes rigorous inline and end-of-line testing.
                From spark testing to conductor resistance measurement — quality is not an afterthought
                at Indocable, it is built into every process.
              </p>
              <p>
                We supply to residential projects, commercial buildings, industrial plants, and
                infrastructure projects across India. Our product range covers everything from
                simple housing wire to multi-core armoured cables for underground distribution.
              </p>
            </div>
            <button
              onClick={() => navigate('/portal/enquiry')}
              className="mt-6 flex items-center gap-2 px-5 py-3 bg-brand-500 hover:bg-brand-600 text-white rounded-2xl font-bold text-sm transition-colors shadow-glow-orange"
            >
              Get in Touch <ArrowRight size={15} />
            </button>
          </div>

          {/* Why us cards */}
          <div className="space-y-4">
            {WHY_US.map(item => (
              <div key={item.title} className="bg-white rounded-2xl border border-gray-100 shadow-card p-5">
                <h3 className="font-bold text-gray-900 mb-3">{item.title}</h3>
                <ul className="space-y-2">
                  {item.points.map(p => (
                    <li key={p} className="flex items-start gap-2 text-sm text-gray-600">
                      <CheckCircle2 size={13} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Product Range ── */}
      <section className="bg-gray-50 border-y border-gray-100 py-16">
        <div className="max-w-7xl mx-auto px-4 md:px-7">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-black text-gray-900 tracking-tight">Our Product Range</h2>
            <p className="text-gray-500 mt-2">6 categories — complete range under one roof</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {PRODUCTS.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bg-white rounded-2xl border border-gray-100 shadow-card p-5 flex gap-4">
                <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center flex-shrink-0">
                  <Icon size={18} className="text-brand-500" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm mb-1">{title}</h3>
                  <p className="text-gray-500 text-xs leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="text-center mt-8">
            <button
              onClick={() => navigate('/portal/catalog')}
              className="inline-flex items-center gap-2 px-6 py-3 bg-brand-500 hover:bg-brand-600 text-white rounded-2xl font-bold text-sm transition-colors shadow-glow-orange"
            >
              Browse Full Catalog <ArrowRight size={15} />
            </button>
          </div>
        </div>
      </section>

      {/* ── Certifications ── */}
      <section className="max-w-7xl mx-auto px-4 md:px-7 py-16">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-black text-gray-900 tracking-tight">Certifications & Standards</h2>
          <p className="text-gray-500 mt-2">All products manufactured in compliance with Bureau of Indian Standards</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {CERTS.map(cert => (
            <div key={cert.name} className={`rounded-2xl border p-5 ${cert.color}`}>
              <div className="flex items-start gap-3">
                <CheckCircle2 size={18} className="flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-sm mb-1">{cert.name}</div>
                  <div className="text-xs opacity-70 leading-relaxed">{cert.desc}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Contact / CTA ── */}
      <section
        className="py-16"
        style={{ background: 'linear-gradient(135deg, #0b1120 0%, #1c0300 100%)' }}
      >
        <div className="max-w-7xl mx-auto px-4 md:px-7">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
            <div>
              <h2 className="text-3xl font-black text-white mb-3 tracking-tight">Talk to Our Team</h2>
              <p className="text-slate-400 leading-relaxed mb-6">
                Looking for cables for your project? Our technical team can recommend the right
                cable and give you the best price. Reach us by phone, WhatsApp, or email.
              </p>
              <div className="space-y-3">
                <a href="tel:+918073533289" className="flex items-center gap-3 text-slate-300 hover:text-white transition-colors">
                  <div className="w-9 h-9 rounded-xl bg-brand-500/20 flex items-center justify-center flex-shrink-0">
                    <Phone size={15} className="text-brand-400" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Call / WhatsApp</div>
                    <div className="font-semibold text-sm">+91 80735 33289</div>
                  </div>
                </a>
                <a href="mailto:cables@micagroup.net" className="flex items-center gap-3 text-slate-300 hover:text-white transition-colors">
                  <div className="w-9 h-9 rounded-xl bg-brand-500/20 flex items-center justify-center flex-shrink-0">
                    <Mail size={15} className="text-brand-400" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Email</div>
                    <div className="font-semibold text-sm">cables@micagroup.net</div>
                  </div>
                </a>
                <a href="mailto:sales@indocables.com" className="flex items-center gap-3 text-slate-300 hover:text-white transition-colors">
                  <div className="w-9 h-9 rounded-xl bg-brand-500/20 flex items-center justify-center flex-shrink-0">
                    <Mail size={15} className="text-brand-400" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Sales</div>
                    <div className="font-semibold text-sm">sales@indocables.com</div>
                  </div>
                </a>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => navigate('/portal/enquiry')}
                className="flex items-center justify-center gap-2 px-6 py-4 bg-brand-500 hover:bg-brand-600 text-white rounded-2xl font-bold transition-colors shadow-glow-orange text-base"
              >
                <MessageCircle size={18} /> Send Enquiry Online
              </button>
              <a
                href="https://wa.me/918073533289?text=Hi, I'd like to discuss cable requirements for my project."
                target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-6 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold transition-colors text-base"
              >
                <MessageCircle size={18} /> Chat on WhatsApp
              </a>
              <button
                onClick={() => navigate('/portal/catalog')}
                className="flex items-center justify-center gap-2 px-6 py-4 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-2xl font-bold transition-colors"
              >
                Browse Product Catalog <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
