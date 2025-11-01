declare module '@stellar/freighter-api' {
  export function isConnected(): Promise<boolean>;
  
  export function getAddress(): Promise<{
    address: string;
    error?: string;
  }>;
  
  export function requestAccess(): Promise<{
    address?: string;
    error?: string;
  }>;
  
  export function signTransaction(
    xdr: string,
    opts?: {
      network?: string;
      networkPassphrase?: string;
      accountToSign?: string;
    }
  ): Promise<{
    signedTransaction: string;
    error?: string;
  }>;

  export function getNetwork(): Promise<{
    network: string;
    networkPassphrase: string;
  }>;

  export function getNetworkDetails(): Promise<{
    network: string;
    networkPassphrase: string;
    networkUrl: string;
    sorobanRpcUrl?: string;
  }>;
}