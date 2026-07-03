#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, Address, BytesN, Env};

mod receipt_gate {
    soroban_sdk::contractimport!(
        file = "../../target/wasm32v1-none/release/receipt_gate.wasm"
    );
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
    let trusted = BytesN::from_array(env, &[9; 32]);

    let gate_id = env.register(receipt_gate::WASM, ());
    let gate_client = receipt_gate::Client::new(env, &gate_id);
    gate_client.init(&admin, &trusted);

    let settlement_id = env.register(Settlement, ());
    let settlement_client = SettlementClient::new(env, &settlement_id);
    settlement_client.init(&admin, &gate_id, &1_000_i128);

    (admin, gate_client, gate_id, settlement_client)
}

#[test]
fn settle_succeeds_with_valid_receipt() {
    let env = Env::default();
    env.mock_all_auths();

    let (admin, gate_client, _gate_id, settlement_client) = setup(&env);
    let buyer = Address::generate(&env);

    let trusted = BytesN::from_array(&env, &[9; 32]);
    let root = BytesN::from_array(&env, &[1; 32]);
    let nullifier = BytesN::from_array(&env, &[2; 32]);
    let action = BytesN::from_array(&env, &[3; 32]);

    gate_client.record_pass(&root, &nullifier, &action, &trusted);

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

    let trusted = BytesN::from_array(&env, &[9; 32]);
    let root = BytesN::from_array(&env, &[1; 32]);
    let nullifier = BytesN::from_array(&env, &[2; 32]);
    let action = BytesN::from_array(&env, &[3; 32]);
    let other_action = BytesN::from_array(&env, &[4; 32]);

    gate_client.record_pass(&root, &nullifier, &action, &trusted);

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

    let trusted = BytesN::from_array(&env, &[9; 32]);
    let root = BytesN::from_array(&env, &[1; 32]);
    let nullifier = BytesN::from_array(&env, &[2; 32]);
    let action = BytesN::from_array(&env, &[3; 32]);

    gate_client.record_pass(&root, &nullifier, &action, &trusted);
    settlement_client.settle(&buyer, &nullifier, &action, &100_i128);

    let err = settlement_client.try_settle(&buyer, &nullifier, &action, &100_i128);

    assert_eq!(err, Err(Ok(SettlementError::AlreadySettled)));
    assert_eq!(settlement_client.balance(&buyer), 100);
}
