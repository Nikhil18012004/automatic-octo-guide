import toast from 'react-hot-toast'

export function confirmToast(message, { confirmLabel = 'Delete', danger = true } = {}) {
  return new Promise(resolve => {
    toast.custom(t => (
      <div className={`flex flex-col gap-3 bg-white border border-gray-200 rounded-2xl shadow-xl p-4 w-72
        transition-all duration-150 ${t.visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>
        <p className="text-sm font-medium text-gray-800 leading-snug">{message}</p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={() => { toast.dismiss(t.id); resolve(false) }}
            className="px-3 py-1.5 text-xs font-semibold text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
            Cancel
          </button>
          <button
            onClick={() => { toast.dismiss(t.id); resolve(true) }}
            className={`px-3 py-1.5 text-xs font-semibold text-white rounded-lg cursor-pointer transition-colors
              ${danger ? 'bg-red-500 hover:bg-red-600' : 'bg-brand-500 hover:bg-brand-600'}`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    ), { duration: Infinity })
  })
}
