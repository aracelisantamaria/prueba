// src/components/AssetBalance.jsx

'use client';

import { useState, useEffect } from 'react';
// Importar Stellar SDK para consultar la red
import { Server } from 'stellar-sdk';
// Importar constantes
import { HORIZON_URLS } from '../lib/constants';
// Importar Spinner
import Spinner from './Spinner';

/**
 * Componente AssetBalance
 * 
 * Propósito: Mostrar el balance de un asset nativo
 * 
 * Props:
 * - publicKey: Public key del usuario
 * - asset: Objeto con { code, issuer } del asset a consultar
 * 
 * MEJORA: Ahora recibe un objeto Asset completo en vez de props separadas
 * Esto hace el componente más flexible y reutilizable
 */
export default function AssetBalance({ publicKey, asset }) {
  // Estado para guardar el balance
  const [balance, setBalance] = useState(null);
  
  // Estado para mostrar loading
  const [loading, setLoading] = useState(false);
  
  // Estado para errores
  const [error, setError] = useState(null);

  /**
   * Función para consultar el balance desde Stellar
   */
  const fetchBalance = async () => {
    // Si no hay public key, no hacer nada
    if (!publicKey) {
      setError('Conecta tu wallet primero');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Crear conexión al servidor de Stellar (testnet)
      // Usando constante centralizada en vez de hardcodear URL
      const server = new Server(HORIZON_URLS.testnet);
      
      // Cargar la cuenta desde la red
      // Esto trae TODOS los datos de la cuenta
      const account = await server.loadAccount(publicKey);
      
      // account.balances es un array con todos los assets que la cuenta tiene
      // Ejemplo:
      // [
      //   { asset_type: 'native', balance: '100.0000000' },  // XLM
      //   { asset_code: 'USDC', asset_issuer: 'GBBD47...', balance: '50.0000000' },
      //   { asset_code: 'EURC', asset_issuer: 'GBBD47...', balance: '25.0000000' }
      // ]
      
      // Buscar el asset específico que queremos
      // IMPORTANTE: Comparamos AMBOS (código Y issuer)
      const assetBalance = account.balances.find(b => 
        b.asset_code === asset.code && 
        b.asset_issuer === asset.issuer
      );
      
      // Si encontramos el balance, guardarlo
      // Si no, poner '0' (no tiene trustline o balance vacío)
      setBalance(assetBalance ? assetBalance.balance : '0');
      
    } catch (err) {
      // Manejar diferentes tipos de errores
      if (err.response && err.response.status === 404) {
        // Cuenta no existe (no está fondeada)
        setError('Cuenta no encontrada. ¿Tienes XLM en testnet?');
      } else {
        // Otro error
        setError(`Error: ${err.message}`);
      }
      console.error('Error fetching balance:', err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * useEffect: Consultar balance automáticamente cuando cambia publicKey o asset
   */
  useEffect(() => {
    if (publicKey) {
      fetchBalance();
    }
  }, [publicKey, asset.code, asset.issuer]); // Dependencias: recarga si cambia el asset

  // ========== RENDER DEL COMPONENTE ==========
  
  return (
    <div className="p-6 bg-white rounded-lg shadow-md border border-gray-200">
      {/* Título */}
      <h2 className="text-2xl font-bold mb-2 text-gray-800">
        💰 Balance de {asset.code}
      </h2>
      
      {/* Mostrar issuer (primeros 8 caracteres para no saturar) */}
      <p className="text-sm text-gray-500 mb-4">
        Issuer: {asset.issuer.slice(0, 8)}...
      </p>
      
      {/* Mostrar error si existe */}
      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 rounded">
          <p className="text-red-700 text-sm">❌ {error}</p>
        </div>
      )}
      
      {/* Botón para refrescar balance */}
      <button
        onClick={fetchBalance}
        disabled={loading || !publicKey}
        className="w-full px-4 py-2 bg-green-500 text-white font-semibold rounded-lg 
                   hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed
                   transition-colors mb-4 flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <Spinner />
            <span>Cargando...</span>
          </>
        ) : (
          '🔄 Actualizar Balance'
        )}
      </button>
      
      {/* Mostrar balance */}
      {balance !== null && (
        <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
          <p className="text-4xl font-bold text-blue-600 text-center">
            {balance} {asset.code}
          </p>
          
          {/* Mensaje si el balance es 0 */}
          {balance === '0' && (
            <div className="mt-4 p-3 bg-yellow-50 rounded border border-yellow-200">
              <p className="text-sm text-gray-600 text-center">
                No tienes {asset.code}. 
              </p>
              <p className="text-xs text-gray-500 text-center mt-2">
                💡 Tip: Crea una trustline primero, luego usa Stellar Laboratory 
                para enviar {asset.code} de prueba a tu cuenta.
              </p>
            </div>
          )}
        </div>
      )}
      
      {/* Info adicional */}
      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
        <p className="text-xs text-gray-600">
          <strong>💡 ¿Cómo obtener {asset.code} en testnet?</strong>
        </p>
        <ol className="text-xs text-gray-600 mt-2 space-y-1 list-decimal list-inside">
          <li>Ve a <a href="https://laboratory.stellar.org" target="_blank" className="text-blue-500 underline">Stellar Laboratory</a></li>
          <li>Crea otra cuenta de prueba con Friendbot</li>
          <li>Crea trustline para {asset.code} en esa cuenta</li>
          <li>Usa "Build Transaction" para enviar {asset.code} a tu cuenta</li>
        </ol>
      </div>
    </div>
  );
}