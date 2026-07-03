fn hash_pair(left: Field, right: Field) -> Field {
    std::hash::pedersen_hash([left, right])
}

fn select_hash(current: Field, sibling: Field, sibling_on_left: bool) -> Field {
    if sibling_on_left {
        hash_pair(sibling, current)
    } else {
        hash_pair(current, sibling)
    }
}

fn derive_nullifier(leaf: Field, action_hash: Field) -> Field {
    std::hash::pedersen_hash([leaf, action_hash])
}

fn main(
    leaf: Field,
    sibling_0: Field,
    sibling_1: Field,
    sibling_0_on_left: bool,
    sibling_1_on_left: bool,
    reserve_value: u64,
    threshold: pub u64,
    credential_root: pub Field,
    action_hash: Field,
    nullifier: pub Field,
) {
    let level_1 = select_hash(leaf, sibling_0, sibling_0_on_left);
    let computed_root = select_hash(level_1, sibling_1, sibling_1_on_left);
    assert(computed_root == credential_root);

    assert(reserve_value >= threshold);
    assert(nullifier == derive_nullifier(leaf, action_hash));
}

#[test]
fn valid_membership_threshold_and_nullifier() {
    let leaf = 11;
    let sibling_0 = 22;
    let sibling_1 = 33;
    let action_hash = 44;
    let level_1 = hash_pair(leaf, sibling_0);
    let root = hash_pair(sibling_1, level_1);
    let nullifier = derive_nullifier(leaf, action_hash);

    main(
        leaf,
        sibling_0,
        sibling_1,
        false,
        true,
        75,
        50,
        root,
        action_hash,
        nullifier,
    );
}

#[test(should_fail)]
fn rejects_invalid_merkle_witness() {
    let leaf = 11;
    let sibling_0 = 22;
    let sibling_1 = 33;
    let action_hash = 44;
    let level_1 = hash_pair(leaf, sibling_0);
    let root = hash_pair(sibling_1, level_1) + 1;
    let nullifier = derive_nullifier(leaf, action_hash);

    main(
        leaf,
        sibling_0,
        sibling_1,
        false,
        true,
        75,
        50,
        root,
        action_hash,
        nullifier,
    );
}

#[test(should_fail)]
fn rejects_threshold_failure() {
    let leaf = 11;
    let sibling_0 = 22;
    let sibling_1 = 33;
    let action_hash = 44;
    let level_1 = hash_pair(leaf, sibling_0);
    let root = hash_pair(sibling_1, level_1);
    let nullifier = derive_nullifier(leaf, action_hash);

    main(
        leaf,
        sibling_0,
        sibling_1,
        false,
        true,
        49,
        50,
        root,
        action_hash,
        nullifier,
    );
}

#[test(should_fail)]
fn rejects_tampered_public_nullifier() {
    let leaf = 11;
    let sibling_0 = 22;
    let sibling_1 = 33;
    let action_hash = 44;
    let level_1 = hash_pair(leaf, sibling_0);
    let root = hash_pair(sibling_1, level_1);
    let nullifier = derive_nullifier(leaf, action_hash) + 1;

    main(
        leaf,
        sibling_0,
        sibling_1,
        false,
        true,
        75,
        50,
        root,
        action_hash,
        nullifier,
    );
}
