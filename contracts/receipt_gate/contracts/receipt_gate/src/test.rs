#![cfg(test)]

use super::*;
use soroban_sdk::{
    contract, contracterror, contractimpl, testutils::Address as _, Address, Bytes, BytesN, Env,
};

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
fn records_pass_receipt() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(ReceiptGate, ());
    let client = ReceiptGateClient::new(&env, &contract_id);
    let verifier = env.register(MockVerifier, ());

    let admin = Address::generate(&env);
    let root = BytesN::from_array(&env, &[1; 32]);
    let nullifier = BytesN::from_array(&env, &[2; 32]);
    let action = BytesN::from_array(&env, &[3; 32]);

    client.init(&admin, &verifier);
    let receipt = client.record_pass(
        &root,
        &nullifier,
        &action,
        &public_inputs(&env, &root, &nullifier),
        &valid_proof(&env),
    );

    assert_eq!(receipt.credential_root, root);
    assert_eq!(receipt.nullifier, nullifier);
    assert_eq!(receipt.action_id, action);
}

#[test]
fn rejects_duplicate_nullifier() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(ReceiptGate, ());
    let client = ReceiptGateClient::new(&env, &contract_id);
    let verifier = env.register(MockVerifier, ());

    let admin = Address::generate(&env);
    let root = BytesN::from_array(&env, &[1; 32]);
    let nullifier = BytesN::from_array(&env, &[2; 32]);
    let action = BytesN::from_array(&env, &[3; 32]);
    let public_inputs = public_inputs(&env, &root, &nullifier);
    let proof = valid_proof(&env);

    client.init(&admin, &verifier);
    client.record_pass(&root, &nullifier, &action, &public_inputs, &proof);
    let err = client.try_record_pass(&root, &nullifier, &action, &public_inputs, &proof);

    assert_eq!(err, Err(Ok(GateError::DuplicateNullifier)));
}

#[test]
fn rejects_tampered_public_inputs() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(ReceiptGate, ());
    let client = ReceiptGateClient::new(&env, &contract_id);
    let verifier = env.register(MockVerifier, ());

    let admin = Address::generate(&env);
    let root = BytesN::from_array(&env, &[1; 32]);
    let nullifier = BytesN::from_array(&env, &[2; 32]);
    let action = BytesN::from_array(&env, &[3; 32]);
    let tampered_nullifier = BytesN::from_array(&env, &[8; 32]);

    client.init(&admin, &verifier);
    let err = client.try_record_pass(
        &root,
        &nullifier,
        &action,
        &public_inputs(&env, &root, &tampered_nullifier),
        &valid_proof(&env),
    );

    assert_eq!(err, Err(Ok(GateError::BadVerifierEvidence)));
}

#[test]
fn rejects_verifier_failure() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(ReceiptGate, ());
    let client = ReceiptGateClient::new(&env, &contract_id);
    let verifier = env.register(MockVerifier, ());

    let admin = Address::generate(&env);
    let root = BytesN::from_array(&env, &[1; 32]);
    let nullifier = BytesN::from_array(&env, &[2; 32]);
    let action = BytesN::from_array(&env, &[3; 32]);
    let rejected_proof = Bytes::from_array(&env, &[1, 2]);

    client.init(&admin, &verifier);
    let err = client.try_record_pass(
        &root,
        &nullifier,
        &action,
        &public_inputs(&env, &root, &nullifier),
        &rejected_proof,
    );

    assert_eq!(err, Err(Ok(GateError::BadVerifierEvidence)));
}

#[test]
fn rejects_reinitialization() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(ReceiptGate, ());
    let client = ReceiptGateClient::new(&env, &contract_id);
    let verifier = env.register(MockVerifier, ());
    let other_verifier = Address::generate(&env);

    let admin = Address::generate(&env);

    client.init(&admin, &verifier);
    let err = client.try_init(&admin, &other_verifier);

    assert_eq!(err, Err(Ok(GateError::AlreadyInitialized)));
}

#[test]
fn get_receipt_for_action_returns_matching_receipt() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(ReceiptGate, ());
    let client = ReceiptGateClient::new(&env, &contract_id);
    let verifier = env.register(MockVerifier, ());

    let admin = Address::generate(&env);
    let root = BytesN::from_array(&env, &[1; 32]);
    let nullifier = BytesN::from_array(&env, &[2; 32]);
    let action = BytesN::from_array(&env, &[3; 32]);

    client.init(&admin, &verifier);
    client.record_pass(
        &root,
        &nullifier,
        &action,
        &public_inputs(&env, &root, &nullifier),
        &valid_proof(&env),
    );

    let receipt = client.get_receipt_for_action(&nullifier, &action);
    assert_eq!(receipt.action_id, action);

    let wrong_action = BytesN::from_array(&env, &[4; 32]);
    let err = client.try_get_receipt_for_action(&nullifier, &wrong_action);
    assert_eq!(err, Err(Ok(GateError::ReceiptNotFound)));
}
