// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IEscrowCallback {
    function assertionResolvedCallback(bytes32 assertionId, bool assertedTruthfully) external;
    function assertionDisputedCallback(bytes32 assertionId) external;
}

contract MockOptimisticOracleV3 {
    uint256 public minimumBond = 1e6; // 1 USDC
    bytes32 public constant DEFAULT_IDENTIFIER = bytes32("ASSERT_TRUTH");

    struct MockAssertion {
        address callbackRecipient;
        bool settled;
        bool settlementResolution;
    }

    mapping(bytes32 => MockAssertion) public assertions;
    uint256 private nonce;

    function assertTruth(
        bytes calldata,
        address,
        address callbackRecipient,
        address,
        uint64,
        IERC20 currency,
        uint256 bond,
        bytes32,
        bytes32
    ) external returns (bytes32 assertionId) {
        assertionId = keccak256(abi.encodePacked(nonce++, block.timestamp));
        assertions[assertionId] = MockAssertion({
            callbackRecipient: callbackRecipient,
            settled: false,
            settlementResolution: false
        });

        // Pull bond from the caller (the escrow contract)
        currency.transferFrom(msg.sender, address(this), bond);

        return assertionId;
    }

    function settleAssertion(bytes32) external {
        // No-op in mock — use resolveAssertion instead
    }

    function getMinimumBond(address) external view returns (uint256) {
        return minimumBond;
    }

    function defaultIdentifier() external pure returns (bytes32) {
        return DEFAULT_IDENTIFIER;
    }

    function getAssertion(bytes32 assertionId) external view returns (
        bool settled,
        bool settlementResolution
    ) {
        MockAssertion storage a = assertions[assertionId];
        return (a.settled, a.settlementResolution);
    }

    // ---- Test helpers ----

    function resolveAssertion(bytes32 assertionId, bool truthfully) external {
        MockAssertion storage a = assertions[assertionId];
        require(a.callbackRecipient != address(0), "Assertion not found");
        require(!a.settled, "Already settled");

        a.settled = true;
        a.settlementResolution = truthfully;

        IEscrowCallback(a.callbackRecipient).assertionResolvedCallback(
            assertionId,
            truthfully
        );
    }

    function disputeAssertion(bytes32 assertionId) external {
        MockAssertion storage a = assertions[assertionId];
        require(a.callbackRecipient != address(0), "Assertion not found");

        IEscrowCallback(a.callbackRecipient).assertionDisputedCallback(
            assertionId
        );
    }

    function setMinimumBond(uint256 _bond) external {
        minimumBond = _bond;
    }
}
