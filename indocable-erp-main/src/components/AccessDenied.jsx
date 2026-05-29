import { useNavigate } from 'react-router-dom'
import { ShieldOff, ArrowLeft } from 'lucide-react'

export default function AccessDenied() {
  const navigate = useNavigate()
  return (
    <div className="min-h-[60vh] flex items-center justify-center animate-fade-in">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-red-50 rounded-2xl mb-5 border border-red-100">
          <ShieldOff className="text-red-500" size={28} />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2 tracking-tight">Access Denied</h2>
        <p className="text-gray-500 text-sm mb-7 max-w-xs mx-auto">
          You don't have permission to view this page. Contact your administrator if you need access.
        </p>
        <button
          onClick={() => navigate('/')}
          className="btn-primary"
        >
          <ArrowLeft size={16} /> Back to Dashboard
        </button>
      </div>
    </div>
  )
}
