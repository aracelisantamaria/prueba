// src/components/CreateTrustline.jsx

'use client';

import { useState } from 'react';
// Importar clases necesarias de Stellar SDK
import { 
  Server,           // Para conectar a Stellar
  TransactionBuilder, // Para construir transacciones
  Operation,        // Para operaciones (ChangeTrust)
  Asset,            // Para definir assets
  Networks          // Para especificar red (testnet/mainnet)
} from 'stellar-sdk';
// Importar Freighter API para firmar
import { signTransaction, getPublicKey } from '@stellar/freighter-api';
// Importar cliente de Supabase
import { supabase } from '../lib/supabase';
// Importar constantes
import { HORIZON_URLS } from '../lib/constants';
// Importar Spinner
import Spinner from './Spinner';

/**
 * Componente CreateTrustline
 * 
 * Propósito: Crear una trustline para un asset nativo
 * 
 * Props:
 * - asset: Objeto { code, issuer } del asset
 * - onSuccess: Callback cuando trustline se crea exitosamente
 * 
 * MEJORA: Ahora valida si la trustline ya existe antes de crearla
 */
export default function CreateTrustline({ asset, onSuccess }) {
  // Estado para mostrar loading
  const [loading, setLoading] = useState(false);
  
  // Estado para mensajes de éxito/error
  const [status, setStatus] = useState({ type: '', message: '' });
  
  // Estado para saber si la trustline ya existe
  const [trustlineExists, setTrustlineExists] = useState(false);

  /**
   * Función para verificar si la trustline ya existe
   * Se llama antes de intentar crearla
   */
  const checkExistingTrustline = async (publicKey) => {
    try {
      // Verificar en Stellar Network
      const server = new Server(HORIZON_URLS.testnet);
      const account = await server.loadAccount(publicKey);
      
      // Buscar si ya existe el asset en los balances
      const existsOnChain = account.balances.some(
        b => b.asset_code === asset.code && b.asset_issuer === asset.issuer
      );
      
      if (existsOnChain) {
        return { exists: true, source: 'blockchain' };
      }
      
      // Si no existe en blockchain, verificar en Supabase
      // (por si hubo un error anterior y quedó registrado)
      const { data, error } = await supabase
        .from('trustlines')
        .select('*')
        .eq('user_id', publicKey)
        .eq('asset_code', asset.code)
        .eq('asset_issuer', asset.issuer)
        .limit(1);
      
      if (error) {
        console.error('Error checking Supabase:', error);
        return { exists: false, source: null };
      }
      
      if (data && data.length > 0) {
        return { exists: true, source: 'database' };
      }
      
      return { exists: false, source: null };
      
    } catch (err) {
      console.error('Error checking trustline:', err);
      return { exists: false, source: null };
    }
  };

  /**
   * Función principal para crear la trustline
   */
  const createTrustline = async () => {
    setLoading(true);
    setStatus({ type: '', message: '' });

    try {
      // ========== PASO 1: OBTENER PUBLIC KEY ==========
      const publicKey = await getPublicKey();
      
      if (!publicKey) {
        throw new Error('No se pudo obtener la public key');
      }

      // ========== PASO 1.5: VERIFICAR SI YA EXISTE ==========
      // MEJORA: Evitar crear trustlines duplicadas
      const { exists, source } = await checkExistingTrustline(publicKey);
      
      if (exists) {
        setTrustlineExists(true);
        setStatus({
          type: 'warning',
          message: `⚠️ Ya tienes una trustline para ${asset.code}. No necesitas crear otra.`
        });
        setLoading(false);
        return; // Salir sin crear
      }

      // ========== PASO 2: CONECTAR A STELLAR ==========
      const server = new Server(HORIZON_URLS.testnet);
      
      // Cargar la cuenta para obtener su sequence number
      const account = await server.loadAccount(publicKey);

      // ========== PASO 3: DEFINIR EL ASSET ==========
      // Crear objeto Asset desde las props
      const stellarAsset = new Asset(asset.code, asset.issuer);

      // ========== PASO 4: CONSTRUIR LA TRANSACCIÓN ==========
      const transaction = new TransactionBuilder(account, {
        // Fee: 100 stroops = 0.00001 XLM
        fee: '100',
        
        // Network: TESTNET (MUY IMPORTANTE)
        networkPassphrase: Networks.TESTNET
      })
        // Agregar la operación ChangeTrust
        .addOperation(
          Operation.changeTrust({
            asset: stellarAsset,    // El asset para crear trustline
            limit: '10000'          // Límite: máximo que quieres tener
          })
        )
        // Timeout: Transacción expira en 30 segundos
        .setTimeout(30)
        // Construir (prepara para firmar)
        .build();

      // ========== PASO 5: FIRMAR CON FREIGHTER ==========
      // Convertir a XDR (formato que Freighter entiende)
      const xdr = transaction.toXDR();
      
      // Pedir a Freighter que firme (abre popup)
      const signedXDR = await signTransaction(xdr, {
        network: 'TESTNET',
        networkPassphrase: Networks.TESTNET
      });

      // ========== PASO 6: ENVIAR A STELLAR ==========
      // Reconstruir transacción desde XDR firmado
      const signedTransaction = TransactionBuilder.fromXDR(
        signedXDR,
        Networks.TESTNET
      );
      
      // Enviar a la red (3-5 segundos)
      const result = await server.submitTransaction(signedTransaction);

      // ========== PASO 7: GUARDAR EN SUPABASE ==========
      // Guardar metadata en nuestra base de datos
      const { error: dbError } = await supabase
        .from('trustlines')
        .insert({
          user_id: publicKey,
          asset_code: asset.code,
          asset_issuer: asset.issuer,
          trust_limit: 10000,
          tx_hash: result.hash  // Hash de blockchain
        });

      if (dbError) {
        console.error('Error saving to Supabase:', dbError);
        // No lanzamos error porque la trustline SÍ se creó en Stellar
      }

      // ========== PASO 8: NOTIFICAR ÉXITO ==========
      setStatus({
        type: 'success',
        message: `✅ Trustline creada exitosamente! Ahora puedes recibir ${asset.code}.`
      });
      
      setTrustlineExists(true); // Marcar que ya existe
      
      // Llamar callback si existe
      if (onSuccess) {
        onSuccess();
      }

    } catch (err) {
      // ========== MANEJO DE ERRORES ==========
      console.error('Error creating trustline:', err);
      
      // Diferentes tipos de errores
      let errorMessage = 'Error desconocido';
      
      if (err.message.includes('User declined')) {
        errorMessage = 'Rechazaste la transacción en Freighter';
      } else if (err.response && err.response.data) {
        // Errores de Stellar
        const resultCode = err.response.data.extras?.result_codes?.operations?.[0];
        
        if (resultCode === 'op_low_reserve') {
          errorMessage = 'Balance insuficiente. Necesitas al menos 0.5 XLM más.';
        } else if (resultCode === 'op_line_full') {
          errorMessage = 'Ya tienes la trustline creada.';
        } else {
          errorMessage = `Error de Stellar: ${resultCode || 'Desconocido'}`;
        }
      } else {
        errorMessage = err.message;
      }
      
      setStatus({
        type: 'error',
        message: `❌ ${errorMessage}`
      });
      
    } finally {
      setLoading(false);
    }
  };

  // ========== RENDER DEL COMPONENTE ==========
  
  return (
    <div className="p-6 bg-white rounded-lg shadow-md border border-gray-200">
      {/* Título */}
      <h2 className="text-2xl font-bold mb-2 text-gray-800">
        ✅ Crear Trustline
      </h2>
      
      <p className="text-sm text-gray-600 mb-4">
        Esto te permitirá recibir y enviar <strong>{asset.code}</strong>
      </p>
      
      {/* Warning sobre el costo */}
      <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200 mb-4">
        <p className="text-sm text-yellow-800">
          ⚠️ <strong>Costo:</strong> 0.5 XLM de base reserve (recuperable si eliminas la trustline)
        </p>
      </div>
      
      {/* Mostrar mensaje de status */}
      {status.message && (
        <div className={`p-3 rounded-lg mb-4 ${
          status.type === 'success' 
            ? 'bg-green-100 border border-green-400 text-green-800'
            : status.type === 'warning'
            ? 'bg-yellow-100 border border-yellow-400 text-yellow-800'
            : 'bg-red-100 border border-red-400 text-red-800'
        }`}>
          <p className="text-sm">{status.message}</p>
        </div>
      )}
      
      {/* Botón para crear trustline */}
      <button
        onClick={createTrustline}
        disabled={loading || trustlineExists}
        className="w-full px-6 py-3 bg-purple-500 text-white font-semibold rounded-lg 
                   hover:bg-purple-600 disabled:bg-gray-400 disabled:cursor-not-allowed
                   transition-colors flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <Spinner />
            <span>Creando...</span>
          </>
        ) : trustlineExists ? (
          '✅ Trustline Ya Existe'
        ) : (
          '✅ Crear Trustline'
        )}
      </button>
      
      {/* Información adicional */}
      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
        <p className="text-xs text-gray-600">
          <strong>¿Qué pasa cuando creas una trustline?</strong>
        </p>
        <ul className="text-xs text-gray-600 mt-2 space-y-1 list-disc list-inside">
          <li>Se "congela" 0.5 XLM (base reserve)</li>
          <li>Puedes recibir hasta 10,000 {asset.code}</li>
          <li>La transacción se registra en blockchain</li>
          <li>Freighter te pedirá confirmar (con tu secret key)</li>
          <li>El sistema verifica que no exista una trustline duplicada</li>
        </ul>
      </div>
    </div>
  );
}