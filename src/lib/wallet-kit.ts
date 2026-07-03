import { Networks, StellarWalletsKit } from "@creit.tech/stellar-wallets-kit";
import { FreighterModule } from "@creit.tech/stellar-wallets-kit/modules/freighter";
import { normalizeWalletError } from "./errors";

export type SignTransaction = (
  xdr: string,
  opts?: {
    networkPassphrase?: string;
    address?: string;
  },
) => Promise<{ signedTxXdr: string; signerAddress?: string }>;

export type WalletConnection = {
  address: string;
  signTransaction: SignTransaction;
};

let initialized = false;

export function initWalletKit() {
  if (initialized) {
    return;
  }

  StellarWalletsKit.init({
    network: Networks.TESTNET,
    modules: [new FreighterModule()],
    authModal: {
      hideUnsupportedWallets: false,
      showInstallLabel: true,
    },
  });

  initialized = true;
}

export async function openWalletModal(): Promise<WalletConnection> {
  initWalletKit();

  try {
    const { address } = await StellarWalletsKit.authModal();
    return {
      address,
      signTransaction: StellarWalletsKit.signTransaction.bind(StellarWalletsKit),
    };
  } catch (error) {
    throw normalizeWalletError(error);
  }
}

export async function disconnectWallet() {
  initWalletKit();
  await StellarWalletsKit.disconnect();
}
