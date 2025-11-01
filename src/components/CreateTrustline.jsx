'use client';

import { useState } from 'react';
import { 
  isConnected, 
  getAddress,
  signTransaction 
} from "@stellar/freighter-api";
import { supabase } from '../lib/supabase';
import { HORIZON_URLS } from '../lib/constants';
import Spinner from './Spinner';

export default function CreateTrustline({ asset, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });
  const [trustlineExists, setTrustlineExists] = useState(false);

  const checkExistingTrustline = async (publicKey, StellarSdk) => {
    try {
      const server = new StellarSdk.Horizon.Server(HORIZON_URLS.testnet);
      const account = await server.loadAccount(publicKey);
      
      const existsOnChain = account.balances.some(
        b => b.asset_code === asset.code && b.asset_issuer === asset.issuer
      );
      
      if (existsOnChain) {
        return { exists: true, source: 'blockchain' };
      }
      
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

  const createTrustline = async () => {
    setLoading(true);
    setStatus({ type: '', message: '' });

    try {
      // ✅ Import dinámico de Stellar SDK
      const StellarSdk = await import('@stellar/stellar-sdk');
      
      if (!(await isConnected())) {
        throw new Error('Freighter no está conectado');
      }
      
      const addressResult = await getAddress();
      const publicKey = addressResult.address;
      console.log("Wallet public key:", publicKey);
      
      if (!publicKey) {
        throw new Error('No se pudo obtener la public key');
      }

      const { exists } = await checkExistingTrustline(publicKey, StellarSdk);
      
      if (exists) {
        setTrustlineExists(true);
        setStatus({
          type: 'warning',
          message: `⚠️ Ya tienes una trustline para ${asset.code}. No necesitas crear otra.`
        });
        setLoading(false);
        return;
      }

      const server = new StellarSdk.Horizon.Server(HORIZON_URLS.testnet);
      const account = await server.loadAccount(publicKey);

      const stellarAsset = new StellarSdk.Asset(asset.code, asset.issuer);

      const transaction = new StellarSdk.TransactionBuilder(account, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: StellarSdk.Networks.TESTNET
      })
        .addOperation(
          StellarSdk.Operation.changeTrust({
            asset: stellarAsset,
            limit: '10000'
          })
        )
        .setTimeout(30)
        .build();

      const xdr = transaction.toXDR();
      
      const signedXDR = await signTransaction(xdr, {
        networkPassphrase: StellarSdk.Networks.TESTNET
      });

      /* const signedTransaction = StellarSdk.TransactionBuilder.fromXDR(
        signedXDR,
        StellarSdk.Networks.TESTNET
      ); */
      
      //const result = await server.submitTransaction(signedTransaction);
      const result = await fetch(`${HORIZON_URLS.testnet}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ tx: signedXDR })
      }).then(r => r.json());


      const { error: dbError } = await supabase
        .from('trustlines')
        .insert({
          user_id: publicKey,
          asset_code: asset.code,
          asset_issuer: asset.issuer,
          trust_limit: 10000,
          tx_hash: result.hash
        });

      if (dbError) {
        console.error('Error saving to Supabase:', dbError);
      }

      setStatus({
        type: 'success',
        message: `✅ Trustline creada exitosamente! Ahora puedes recibir ${asset.code}.`
      });
      
      setTrustlineExists(true);
      
      if (onSuccess) {
        onSuccess();
      }

    } catch (err) {
      console.error('Error creating trustline:', err);
      
      let errorMessage = 'Error desconocido';
      
      if (err.message.includes('User declined') || err.message.includes('User rejected')) {
        errorMessage = 'Rechazaste la transacción en Freighter';
      } else if (err.message.includes('Freighter no está conectado')) {
        errorMessage = 'Por favor conectá Freighter primero';
      } else if (err.response?.data) {
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

  return (
    <div className="p-6 bg-white rounded-lg shadow-md border border-gray-200">
      <h2 className="text-2xl font-bold mb-2 text-gray-800">
        ✅ Crear Trustline
      </h2>
      
      <p className="text-sm text-gray-600 mb-4">
        Esto te permitirá recibir y enviar <strong>{asset.code}</strong>
      </p>
      
      <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200 mb-4">
        <p className="text-sm text-yellow-800">
          ⚠️ <strong>Costo:</strong> 0.5 XLM de base reserve (recuperable si eliminas la trustline)
        </p>
      </div>
      
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
      
      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
        <p className="text-xs text-gray-600">
          <strong>¿Qué pasa cuando creas una trustline?</strong>
        </p>
        <ul className="text-xs text-gray-600 mt-2 space-y-1 list-disc list-inside">
          <li>Se "congela" 0.5 XLM (base reserve)</li>
          <li>Puedes recibir hasta 10,000 {asset.code}</li>
          <li>La transacción se registra en blockchain</li>
          <li>Freighter te pedirá confirmar</li>
          <li>El sistema verifica que no exista una trustline duplicada</li>
        </ul>
      </div>
    </div>
  );
}