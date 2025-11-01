'use client';

import { useState } from 'react';
import WalletConnect from '@/components/WalletConnect';
import AssetBalance from '@/components/AssetBalance';
import CreateTrustline from '@/components/CreateTrustline';

export default function Home() {
  // Estado para la public key del usuario
  const [publicKey, setPublicKey] = useState('');
  
  // Estado para forzar refresh del balance después de crear trustline
  const [refreshKey, setRefreshKey] = useState(0);

  // Configuración del asset USDC en testnet
  // IMPORTANTE: Este issuer es para TESTNET, no mainnet
  const USDC_TESTNET = {
    code: 'USDC',
    issuer: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5'
  };

  /**
   * Callback cuando la wallet se conecta
   */
  const handleWalletConnect = (key: string) => {
    setPublicKey(key);
    console.log('Wallet connected:', key);
  };

  /**
   * Callback cuando la trustline se crea exitosamente
   * Fuerza un refresh del balance
   */
  const handleTrustlineSuccess = () => {
    // Incrementar refreshKey para forzar re-render de AssetBalance
    setRefreshKey(prev => prev + 1);
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-6 py-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            🚀 Assets Nativos en Stellar
          </h1>
          <p className="text-gray-600 mt-2">Tu dApp de stablecoins en testnet</p>
        </div>
      </div>

      {/* Contenido Principal */}
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Grid de componentes */}
        <div className="space-y-6">
          
          {/* Componente 1: Conectar Wallet */}
          <div className="flex justify-center">
            <WalletConnect onConnect={handleWalletConnect} />
          </div>

          {/* Mostrar wallet conectada */}
          {publicKey && (
            <div className="p-6 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-blue-200 text-center">
              <p className="text-sm text-gray-700">
                <strong>✅ Wallet conectada:</strong>
              </p>
              <p className="font-mono text-lg mt-1 break-all">{publicKey}</p>
            </div>
          )}

          {/* Componentes 2 y 3: Solo mostrar si hay wallet conectada */}
          {publicKey && (
            <>
              {/* Componente 2: Crear Trustline */}
              <CreateTrustline
                asset={USDC_TESTNET}
                onSuccess={handleTrustlineSuccess}
              />

              {/* Componente 3: Ver Balance */}
              <AssetBalance
                key={refreshKey} // Force re-mount cuando cambia refreshKey
                publicKey={publicKey}
                asset={USDC_TESTNET}
              />
            </>
          )}
        </div>

        {/* Instrucciones para el usuario */}
        <div className="mt-8 p-6 bg-yellow-50 rounded-lg border-2 border-yellow-200">
          <h3 className="font-bold text-lg mb-3 text-gray-800">
            📝 Instrucciones:
          </h3>
          <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
            <li>
              <strong>Instala Freighter:</strong>{' '}
              <a 
                href="https://www.freighter.app" 
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                https://www.freighter.app
              </a>
            </li>
            <li>
              <strong>Configura Freighter en testnet</strong> (Settings → Network → Testnet)
            </li>
            <li>
              <strong>Obtén XLM gratis:</strong>{' '}
              <a 
                href="https://friendbot.stellar.org" 
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                https://friendbot.stellar.org
              </a>
            </li>
            <li><strong>Conecta tu wallet</strong> con el botón de arriba</li>
            <li><strong>Crea una trustline</strong> para USDC</li>
            <li><strong>Verifica tu balance</strong> (debería aparecer 0 USDC)</li>
          </ol>
          
          <div className="mt-4 p-3 bg-blue-50 rounded border border-blue-200">
            <p className="text-xs text-blue-800">
              💡 <strong>Tip:</strong> Puedes usar{' '}
              <a 
                href="https://laboratory.stellar.org" 
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                Stellar Laboratory
              </a>
              {' '}para enviar USDC de testnet a tu cuenta y probar que funciona.
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="max-w-4xl mx-auto px-6 py-8 text-center text-sm text-gray-500">
        <p>Construido con 💙 por Tiburonas Builders</p>
        <p className="mt-2">
          Clase 7: Assets Nativos en Stellar
        </p>
      </div>
    </main>
  );
}