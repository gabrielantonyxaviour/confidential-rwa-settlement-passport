type BalanceDisplayProps = {
  address: string | null;
  balance: bigint | null;
  isLoading: boolean;
  error: string | null;
};

export function BalanceDisplay({ address, balance, isLoading, error }: BalanceDisplayProps) {
  return (
    <section className="balance-display">
      <h2>Settlement Balance</h2>
      {!address ? <p>Connect Freighter to load the settlement balance.</p> : null}
      {address && isLoading ? <p>Loading settlement balance...</p> : null}
      {address && !isLoading && !error ? <p>{balance === null ? "No balance loaded." : balance.toString()}</p> : null}
      {error ? <p role="alert">{error}</p> : null}
    </section>
  );
}
