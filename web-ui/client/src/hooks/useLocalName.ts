import * as React from 'react'

export function useLocalName() {
  const [name, setName] = React.useState<string>(() => localStorage.getItem('council:name') || '')
  React.useEffect(() => {
    if (name) localStorage.setItem('council:name', name)
  }, [name])
  return { name, setName }
}
