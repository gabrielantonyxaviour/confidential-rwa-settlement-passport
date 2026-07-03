#![no_std]
use soroban_sdk::{
    contract, contractclient, contracterror, contractimpl, contracttype, Address, BytesN, Env,
};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SettlementPassReceipt {
    pub credential_root: BytesN<32>,
    pub nullifier: BytesN<32>,
    pub action_id: BytesN<32>,
}

/// Mirrors receipt_gate::GateError's wire-level discriminants so cross-contract
/// error decoding lines up. Only the numeric values matter over the wire.
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum GateError {
    AlreadyInitialized = 1,
    BadVerifierEvidence = 2,
    DuplicateNullifier = 3,
    ReceiptNotFound = 4,
}

#[contractclient(name = "ReceiptGateClient")]
pub trait ReceiptGateInterface {
    fn get_receipt_for_action(
        env: Env,
        nullifier: BytesN<32>,
        action_id: BytesN<32>,
    ) -> Result<SettlementPassReceipt, GateError>;
}

#[contract]
pub struct Settlement;

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Admin,
    ReceiptGate,
    Initialized,
    Balance(Address),
    Settled(BytesN<32>),
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum SettlementError {
    AlreadyInitialized = 1,
    InsufficientBalance = 2,
    AlreadySettled = 3,
    ReceiptNotVerified = 4,
}

#[contractimpl]
impl Settlement {
    /// Issues `asset_supply` units of the demo tokenized invoice-note to the
    /// admin (the issuer), and records which receipt_gate contract this
    /// settlement contract trusts to gate transfers.
    pub fn init(
        env: Env,
        admin: Address,
        receipt_gate: Address,
        asset_supply: i128,
    ) -> Result<(), SettlementError> {
        if env.storage().instance().has(&DataKey::Initialized) {
            return Err(SettlementError::AlreadyInitialized);
        }
        admin.require_auth();

        env.storage().instance().set(&DataKey::Initialized, &true);
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::ReceiptGate, &receipt_gate);
        env.storage()
            .persistent()
            .set(&DataKey::Balance(admin), &asset_supply);

        Ok(())
    }

    pub fn balance(env: Env, holder: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::Balance(holder))
            .unwrap_or(0)
    }

    /// Transfers `amount` from the issuer to `buyer`, but ONLY if
    /// `receipt_gate` has a recorded settlement-pass receipt for this exact
    /// nullifier + action_id. That receipt only exists if the buyer already
    /// proved eligibility off-chain and had it recorded on-chain via
    /// `ReceiptGate::record_pass`. A missing or mismatched receipt blocks
    /// the transfer entirely — this is the proof-gated settlement.
    pub fn settle(
        env: Env,
        buyer: Address,
        nullifier: BytesN<32>,
        action_id: BytesN<32>,
        amount: i128,
    ) -> Result<(), SettlementError> {
        buyer.require_auth();

        if env
            .storage()
            .persistent()
            .has(&DataKey::Settled(nullifier.clone()))
        {
            return Err(SettlementError::AlreadySettled);
        }

        let receipt_gate: Address = env.storage().instance().get(&DataKey::ReceiptGate).unwrap();
        let gate_client = ReceiptGateClient::new(&env, &receipt_gate);
        let lookup = gate_client.try_get_receipt_for_action(&nullifier, &action_id);
        let receipt_ok = matches!(lookup, Ok(Ok(_)));
        if !receipt_ok {
            return Err(SettlementError::ReceiptNotVerified);
        }

        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        let admin_balance: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::Balance(admin.clone()))
            .unwrap_or(0);

        if admin_balance < amount {
            return Err(SettlementError::InsufficientBalance);
        }

        let buyer_balance: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::Balance(buyer.clone()))
            .unwrap_or(0);

        env.storage()
            .persistent()
            .set(&DataKey::Balance(admin), &(admin_balance - amount));
        env.storage()
            .persistent()
            .set(&DataKey::Balance(buyer), &(buyer_balance + amount));
        env.storage()
            .persistent()
            .set(&DataKey::Settled(nullifier), &true);

        Ok(())
    }
}

mod test;
