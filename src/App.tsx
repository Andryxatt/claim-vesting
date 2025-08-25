import { createAppKit } from '@reown/appkit/react'
import { solana, solanaTestnet, solanaDevnet } from '@reown/appkit/networks'
import { metadata, projectId, solanaWeb3JsAdapter } from './config'

import "./App.css"
import ClaimToken from './components/ClaimTokens'

// Create modal
createAppKit({
  projectId,
  metadata,
  themeMode: 'dark', // light | dark
  networks: [solana, solanaTestnet, solanaDevnet],
  adapters: [solanaWeb3JsAdapter],
  features: {
    analytics: true // Optional - defaults to your Cloud configuration
  },
  themeVariables: {
    '--w3m-accent': '#000000'
  }
})

export function App() {

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

      <appkit-button />
      <ClaimToken />
    </div>
  )
}

export default App
