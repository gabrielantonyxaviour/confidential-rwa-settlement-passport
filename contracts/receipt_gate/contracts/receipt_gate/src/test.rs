#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, Address, BytesN, Env};

#[test]
fn records_pass_receipt() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(ReceiptGate, ());
    let client = ReceiptGateClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let trusted = BytesN::from_array(&env, &[9; 32]);
    let root = BytesN::from_array(&env, &[1; 32]);
    let nullifier = BytesN::from_array(&env, &[2; 32]);
    let action = BytesN::from_array(&env, &[3; 32]);

    client.init(&admin, &trusted);
    let receipt = client.record_pass(&root, &nullifier, &action, &trusted);

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

    let admin = Address::generate(&env);
    let trusted = BytesN::from_array(&env, &[9; 32]);
    let root = BytesN::from_array(&env, &[1; 32]);
    let nullifier = BytesN::from_array(&env, &[2; 32]);
    let action = BytesN::from_array(&env, &[3; 32]);

    client.init(&admin, &trusted);
    client.record_pass(&root, &nullifier, &action, &trusted);
    let err = client.try_record_pass(&root, &nullifier, &action, &trusted);

    assert_eq!(err, Err(Ok(GateError::DuplicateNullifier)));
}

#[test]
fn rejects_tampered_verifier_evidence() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(ReceiptGate, ());
    let client = ReceiptGateClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let trusted = BytesN::from_array(&env, &[9; 32]);
    let tampered = BytesN::from_array(&env, &[8; 32]);
    let root = BytesN::from_array(&env, &[1; 32]);
    let nullifier = BytesN::from_array(&env, &[2; 32]);
    let action = BytesN::from_array(&env, &[3; 32]);

    client.init(&admin, &trusted);
    let err = client.try_record_pass(&root, &nullifier, &action, &tampered);

    assert_eq!(err, Err(Ok(GateError::BadVerifierEvidence)));
}

#[test]
fn rejects_reinitialization() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(ReceiptGate, ());
    let client = ReceiptGateClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let trusted = BytesN::from_array(&env, &[9; 32]);
    let other_trusted = BytesN::from_array(&env, &[7; 32]);

    client.init(&admin, &trusted);
    let err = client.try_init(&admin, &other_trusted);

    assert_eq!(err, Err(Ok(GateError::AlreadyInitialized)));
}

#[test]
fn get_receipt_for_action_returns_matching_receipt() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(ReceiptGate, ());
    let client = ReceiptGateClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let trusted = BytesN::from_array(&env, &[9; 32]);
    let root = BytesN::from_array(&env, &[1; 32]);
    let nullifier = BytesN::from_array(&env, &[2; 32]);
    let action = BytesN::from_array(&env, &[3; 32]);

    client.init(&admin, &trusted);
    client.record_pass(&root, &nullifier, &action, &trusted);

    let receipt = client.get_receipt_for_action(&nullifier, &action);
    assert_eq!(receipt.action_id, action);

    let wrong_action = BytesN::from_array(&env, &[4; 32]);
    let err = client.try_get_receipt_for_action(&nullifier, &wrong_action);
    assert_eq!(err, Err(Ok(GateError::ReceiptNotFound)));
}
