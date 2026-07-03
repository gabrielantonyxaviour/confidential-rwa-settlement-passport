import { useCallback, useEffect, useState } from "react";
import { AnalyticsPanel } from "./components/AnalyticsPanel";
import { BalanceDisplay } from "./components/BalanceDisplay";
import { FeedbackForm } from "./components/FeedbackForm";
import { ProveEligibilityPanel } from "./components/ProveEligibilityPanel";
import { SettlePanel } from "./components/SettlePanel";
import { TxStatus, type TxStatusState } from "./components/TxStatus";
import { WalletConnect } from "./components/WalletConnect";
import { trackEvent } from "./lib/analytics";
import { DEMO_SETTLEMENT_AMOUNT } from "./lib/config";
import { getBalance, recordPass, settle } from "./lib/contract";
import { getErrorMessage, normalizeContractError } from "./lib/errors";
import {
  generateSettlementProof,
  type SettlementProofResult,
} from "./lib/proof";
import {
  disconnectWallet,
  openWalletModal,
  type SignTransaction,
} from "./lib/wallet-kit";

export default function App() {
  const [address, setAddress] = useState<string | null>(null);
  const [signTransaction, setSignTransaction] =
    useState<SignTransaction | null>(null);
  const [balance, setBalance] = useState<bigint | null>(null);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [proof, setProof] = useState<SettlementProofResult | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isBalanceLoading, setIsBalanceLoading] = useState(false);
  const [isProofGenerating, setIsProofGenerating] = useState(false);
  const [isRecordingPass, setIsRecordingPass] = useState(false);
  const [isSettling, setIsSettling] = useState(false);
  const [recordPassStatus, setRecordPassStatus] = useState<TxStatusState>({
    type: "idle",
  });
  const [settleStatus, setSettleStatus] = useState<TxStatusState>({
    type: "idle",
  });

  const refreshBalance = useCallback(async (walletAddress: string) => {
    setIsBalanceLoading(true);
    setBalanceError(null);

    try {
      setBalance(await getBalance(walletAddress));
    } catch (error) {
      setBalanceError(
        getErrorMessage(error) || "Could not load the settlement balance.",
      );
    } finally {
      setIsBalanceLoading(false);
    }
  }, []);

  useEffect(() => {
    if (address) {
      void refreshBalance(address);
    } else {
      setBalance(null);
      setBalanceError(null);
    }
  }, [address, refreshBalance]);

  async function handleConnect() {
    setIsConnecting(true);
    setRecordPassStatus({ type: "idle" });
    setSettleStatus({ type: "idle" });
    setProof(null);

    try {
      const wallet = await openWalletModal();
      setAddress(wallet.address);
      setSignTransaction(() => wallet.signTransaction);
      trackEvent("wallet_connect", wallet.address);
    } catch (error) {
      setRecordPassStatus({
        type: "error",
        message:
          error instanceof Error ? error.message : "Wallet connection failed.",
      });
    } finally {
      setIsConnecting(false);
    }
  }

  async function handleDisconnect() {
    await disconnectWallet();
    setAddress(null);
    setSignTransaction(null);
    setProof(null);
    setRecordPassStatus({ type: "idle" });
    setSettleStatus({ type: "idle" });
  }

  async function handleProveAndRecord() {
    if (!address || !signTransaction) {
      setRecordPassStatus({
        type: "error",
        message: "Connect Freighter before proving eligibility.",
      });
      return;
    }

    let nextProof: SettlementProofResult;
    setIsProofGenerating(true);
    setRecordPassStatus({
      type: "pending",
      message: "Generating the Noir proof in this browser...",
    });

    try {
      nextProof = await generateSettlementProof(address);
      setProof(nextProof);
    } catch (error) {
      setRecordPassStatus({
        type: "error",
        message:
          getErrorMessage(error) || "Proof generation failed in the browser.",
      });
      setIsProofGenerating(false);
      return;
    }

    setIsProofGenerating(false);
    setIsRecordingPass(true);
    setRecordPassStatus({
      type: "pending",
      message:
        "Proof generated. Waiting for Freighter and Stellar confirmation...",
    });

    try {
      const { hash } = await recordPass(
        address,
        nextProof.credentialRoot,
        nextProof.nullifier,
        nextProof.actionIdHex,
        nextProof,
        signTransaction,
      );
      setRecordPassStatus({
        type: "success",
        message: "Settlement-pass receipt recorded on Stellar testnet.",
        hash,
      });
      trackEvent("proof_generated", address);
    } catch (error) {
      const message = normalizeContractError(error, "receipt_gate");
      setRecordPassStatus({ type: "error", message });
    } finally {
      setIsRecordingPass(false);
    }
  }

  async function handleSettle() {
    if (!address || !signTransaction || !proof) {
      setSettleStatus({
        type: "error",
        message: "Record an eligibility pass before settling.",
      });
      return;
    }

    if (proof.buyerAddress !== address.trim()) {
      setSettleStatus({
        type: "error",
        message:
          "Generate an eligibility pass for the connected wallet before settling.",
      });
      return;
    }

    setIsSettling(true);
    setSettleStatus({
      type: "pending",
      message: "Waiting for Freighter and Stellar settlement confirmation...",
    });

    try {
      const { hash } = await settle(
        address,
        proof.nullifier,
        proof.actionIdHex,
        DEMO_SETTLEMENT_AMOUNT,
        signTransaction,
      );
      setSettleStatus({
        type: "success",
        message: "Demo settlement confirmed on Stellar testnet.",
        hash,
      });
      trackEvent("settled", address);
      await refreshBalance(address);
    } catch (error) {
      setSettleStatus({
        type: "error",
        message: normalizeContractError(error, "settlement"),
      });
    } finally {
      setIsSettling(false);
    }
  }

  return (
    <main className="app-shell">
      <h1>Confidential RWA Settlement Passport</h1>
      <WalletConnect
        address={address}
        isConnecting={isConnecting}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
      />
      <ProveEligibilityPanel
        address={address}
        isGenerating={isProofGenerating}
        isRecording={isRecordingPass}
        proof={proof}
        onProveAndRecord={handleProveAndRecord}
      />
      <TxStatus title="Eligibility Pass" status={recordPassStatus} />
      <SettlePanel
        canSettle={Boolean(address && signTransaction && proof)}
        isSettling={isSettling}
        onSettle={handleSettle}
      />
      <TxStatus title="Settlement" status={settleStatus} />
      <BalanceDisplay
        address={address}
        balance={balance}
        isLoading={isBalanceLoading}
        error={balanceError}
      />
      <FeedbackForm walletAddress={address} />
      <AnalyticsPanel />
    </main>
  );
}
