#![cfg(test)]

use super::*;
use soroban_sdk::{
    contract, contracterror, contractimpl, testutils::Address as _, Address, Bytes, BytesN, Env,
};

mod receipt_gate {
    soroban_sdk::contractimport!(file = "../../target/wasm32v1-none/release/receipt_gate.wasm");
}

#[contract]
struct MockVerifier;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
enum MockVerifierError {
    Rejected = 1,
}

#[contractimpl]
impl MockVerifier {
    pub fn verify_proof(
        _env: Env,
        _public_inputs: Bytes,
        proof_bytes: Bytes,
    ) -> Result<(), MockVerifierError> {
        if proof_bytes.len() == 1 {
            Ok(())
        } else {
            Err(MockVerifierError::Rejected)
        }
    }
}

fn setup<'a>(
    env: &Env,
) -> (
    Address,
    receipt_gate::Client<'a>,
    Address,
    SettlementClient<'a>,
) {
    let admin = Address::generate(env);
    let verifier = env.register(MockVerifier, ());

    let gate_id = env.register(receipt_gate::WASM, ());
    let gate_client = receipt_gate::Client::new(env, &gate_id);
    gate_client.init(&admin, &verifier);

    let settlement_id = env.register(Settlement, ());
    let settlement_client = SettlementClient::new(env, &settlement_id);
    settlement_client.init(&admin, &gate_id, &1_000_i128);

    (admin, gate_client, gate_id, settlement_client)
}

fn public_inputs(env: &Env, root: &BytesN<32>, nullifier: &BytesN<32>) -> Bytes {
    let mut bytes = [0u8; 96];
    bytes[31] = 50;
    bytes[32..64].copy_from_slice(&root.to_array());
    bytes[64..96].copy_from_slice(&nullifier.to_array());
    Bytes::from_array(env, &bytes)
}

fn valid_proof(env: &Env) -> Bytes {
    Bytes::from_array(env, &[1])
}

#[test]
fn settle_succeeds_with_valid_receipt() {
    let env = Env::default();
    env.mock_all_auths();

    let (admin, gate_client, _gate_id, settlement_client) = setup(&env);
    let buyer = Address::generate(&env);

    let root = BytesN::from_array(&env, &[1; 32]);
    let nullifier = BytesN::from_array(&env, &[2; 32]);
    let action = BytesN::from_array(&env, &[3; 32]);

    gate_client.record_pass(
        &root,
        &nullifier,
        &action,
        &public_inputs(&env, &root, &nullifier),
        &valid_proof(&env),
    );

    settlement_client.settle(&buyer, &nullifier, &action, &100_i128);

    assert_eq!(settlement_client.balance(&buyer), 100);
    assert_eq!(settlement_client.balance(&admin), 900);
}

#[test]
fn settle_blocked_without_receipt() {
    let env = Env::default();
    env.mock_all_auths();

    let (_admin, _gate_client, _gate_id, settlement_client) = setup(&env);
    let buyer = Address::generate(&env);

    let nullifier = BytesN::from_array(&env, &[2; 32]);
    let action = BytesN::from_array(&env, &[3; 32]);

    let err = settlement_client.try_settle(&buyer, &nullifier, &action, &100_i128);

    assert_eq!(err, Err(Ok(SettlementError::ReceiptNotVerified)));
    assert_eq!(settlement_client.balance(&buyer), 0);
}

#[test]
fn settle_blocked_for_mismatched_action_id() {
    let env = Env::default();
    env.mock_all_auths();

    let (_admin, gate_client, _gate_id, settlement_client) = setup(&env);
    let buyer = Address::generate(&env);

    let root = BytesN::from_array(&env, &[1; 32]);
    let nullifier = BytesN::from_array(&env, &[2; 32]);
    let action = BytesN::from_array(&env, &[3; 32]);
    let other_action = BytesN::from_array(&env, &[4; 32]);

    gate_client.record_pass(
        &root,
        &nullifier,
        &action,
        &public_inputs(&env, &root, &nullifier),
        &valid_proof(&env),
    );

    let err = settlement_client.try_settle(&buyer, &nullifier, &other_action, &100_i128);

    assert_eq!(err, Err(Ok(SettlementError::ReceiptNotVerified)));
    assert_eq!(settlement_client.balance(&buyer), 0);
}

#[test]
fn settle_rejects_replaying_the_same_receipt_twice() {
    let env = Env::default();
    env.mock_all_auths();

    let (_admin, gate_client, _gate_id, settlement_client) = setup(&env);
    let buyer = Address::generate(&env);

    let root = BytesN::from_array(&env, &[1; 32]);
    let nullifier = BytesN::from_array(&env, &[2; 32]);
    let action = BytesN::from_array(&env, &[3; 32]);

    gate_client.record_pass(
        &root,
        &nullifier,
        &action,
        &public_inputs(&env, &root, &nullifier),
        &valid_proof(&env),
    );
    settlement_client.settle(&buyer, &nullifier, &action, &100_i128);

    let err = settlement_client.try_settle(&buyer, &nullifier, &action, &100_i128);

    assert_eq!(err, Err(Ok(SettlementError::AlreadySettled)));
    assert_eq!(settlement_client.balance(&buyer), 100);
}
