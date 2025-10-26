"use client"

export default function EditTriggerButton() {
  const handleClick = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('catalogo:toggle-edit', { detail: true }))
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 text-sm"
    >
      ✏️ Editar ficha
    </button>
  )
}