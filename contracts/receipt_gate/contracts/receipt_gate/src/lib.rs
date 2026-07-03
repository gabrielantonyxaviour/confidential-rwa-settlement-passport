#![no_std]
use soroban_sdk::{contract, contracterror, contractimpl, contracttype, Address, BytesN, Env};

#[contract]
pub struct ReceiptGate;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SettlementPassReceipt {
    pub credential_root: BytesN<32>,
    pub nullifier: BytesN<32>,
    pub action_id: BytesN<32>,
}

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Admin,
    TrustedVerifierHash,
    Nullifier(BytesN<32>),
    Receipt(BytesN<32>),
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum GateError {
    AlreadyInitialized = 1,
    BadVerifierEvidence = 2,
    DuplicateNullifier = 3,
    ReceiptNotFound = 4,
}

#[contractimpl]
impl ReceiptGate {
    pub fn init(
        env: Env,
        admin: Address,
        trusted_verifier_hash: BytesN<32>,
    ) -> Result<(), GateError> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(GateError::AlreadyInitialized);
        }

        admin.require_auth();

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::TrustedVerifierHash, &trusted_verifier_hash);

        Ok(())
    }

    pub fn record_pass(
        env: Env,
        credential_root: BytesN<32>,
        nullifier: BytesN<32>,
        action_id: BytesN<32>,
        verifier_hash: BytesN<32>,
    ) -> Result<SettlementPassReceipt, GateError> {
        let trusted: BytesN<32> = env
            .storage()
            .instance()
            .get(&DataKey::TrustedVerifierHash)
            .unwrap();

        if verifier_hash != trusted {
            return Err(GateError::BadVerifierEvidence);
        }

        if env
            .storage()
            .persistent()
            .has(&DataKey::Nullifier(nullifier.clone()))
        {
            return Err(GateError::DuplicateNullifier);
        }

        let receipt = SettlementPassReceipt {
            credential_root,
            nullifier: nullifier.clone(),
            action_id,
        };

        env.storage()
            .persistent()
            .set(&DataKey::Nullifier(nullifier.clone()), &true);
        env.storage()
            .persistent()
            .set(&DataKey::Receipt(nullifier), &receipt);

        Ok(receipt)
    }

    /// Returns the recorded receipt for a nullifier, if one exists and its
    /// action_id matches. Used by the settlement contract to gate transfers.
    pub fn get_receipt_for_action(
        env: Env,
        nullifier: BytesN<32>,
        action_id: BytesN<32>,
    ) -> Result<SettlementPassReceipt, GateError> {
        let receipt: SettlementPassReceipt = env
            .storage()
            .persistent()
            .get(&DataKey::Receipt(nullifier))
            .ok_or(GateError::ReceiptNotFound)?;

        if receipt.action_id != action_id {
            return Err(GateError::ReceiptNotFound);
        }

        Ok(receipt)
    }
}

mod test;
