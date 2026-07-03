import { shortAddress } from "../lib/bytes";

type WalletConnectProps = {
  address: string | null;
  isConnecting: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
};

export function WalletConnect({ address, isConnecting, onConnect, onDisconnect }: WalletConnectProps) {
  return (
    <section className="wallet-connect">
      <h2>Wallet</h2>
      {address ? (
        <div className="wallet-connected">
          <p>
            Connected: <span className="wallet-address">{shortAddress(address)}</span>
          </p>
          <button className="wallet-disconnect-button" type="button" onClick={onDisconnect}>
            Disconnect
          </button>
        </div>
      ) : (
        <button className="wallet-connect-button" type="button" onClick={onConnect} disabled={isConnecting}>
          {isConnecting ? "Connecting..." : "Connect Freighter"}
        </button>
      )}
    </section>
  );
}
