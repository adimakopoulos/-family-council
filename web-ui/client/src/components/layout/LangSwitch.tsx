import React from 'react'
import { useTranslation } from 'react-i18next'

export default function LangSwitch() {
  const { i18n } = useTranslation()
  const lang = i18n.language.startsWith('el') ? 'el' : 'en'
  return (
    <div className="flex gap-2">
      <button
        className={`btn px-3 py-1 rounded ${lang==='en' ? 'bg-slate-900 text-white' : 'bg-white border'}`}
        onClick={()=>i18n.changeLanguage('en')}
      >EN</button>
      <button
        className={`btn px-3 py-1 rounded ${lang==='el' ? 'bg-slate-900 text-white' : 'bg-white border'}`}
        onClick={()=>i18n.changeLanguage('el')}
      >EL</button>
    </div>
  )
}
