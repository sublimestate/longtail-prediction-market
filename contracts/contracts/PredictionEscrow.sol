// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IOptimisticOracleV3 {
    function assertTruth(
        bytes calldata claim,
        address asserter,
        address callbackRecipient,
        address escalationManager,
        uint64 liveness,
        IERC20 currency,
        uint256 bond,
        bytes32 defaultIdentifier,
        bytes32 domainId
    ) external returns (bytes32 assertionId);

    function settleAssertion(bytes32 assertionId) external;

    function getMinimumBond(address currency) external view returns (uint256);

    function defaultIdentifier() external view returns (bytes32);
}

contract PredictionEscrow is ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum State { Created, Funded, Resolving, Settled, Expired }

    address public immutable partyYes;
    address public partyNo;
    uint256 public immutable stakeAmount;
    uint256 public immutable deadline;
    string public description;

    IOptimisticOracleV3 public immutable oo;
    IERC20 public immutable currency;

    State public state;
    bytes32 public assertionId;
    bool public resolvedYes;
    bool public proposedOutcomeYes;

    bool public partyYesDeposited;
    bool public partyNoDeposited;

    uint256 public constant EXPIRY_PERIOD = 7 days;
    uint64 public constant LIVENESS = 7200; // 2 hours

    event Deposited(address indexed party, uint256 amount);
    event Matched(address indexed newPartyNo);
    event ResolutionInitiated(bytes32 indexed assertionId, bool proposedOutcome);
    event Settled(bool resolvedYes, address winner);
    event Expired();
    event DisputeReset();

    modifier onlyState(State _state) {
        require(state == _state, "Invalid state");
        _;
    }

    constructor(
        address _partyYes,
        address _partyNo,
        uint256 _stakeAmount,
        uint256 _deadline,
        string memory _description,
        address _oo,
        address _currency
    ) {
        require(_partyYes != address(0), "Invalid partyYes");
        require(_partyYes != _partyNo, "Same party");
        require(_stakeAmount > 0, "Zero stake");
        require(_deadline > block.timestamp, "Deadline passed");

        partyYes = _partyYes;
        partyNo = _partyNo;
        stakeAmount = _stakeAmount;
        deadline = _deadline;
        description = _description;
        oo = IOptimisticOracleV3(_oo);
        currency = IERC20(_currency);
        state = State.Created;
    }

    function deposit() external nonReentrant onlyState(State.Created) {
        if (msg.sender == partyYes) {
            require(!partyYesDeposited, "Already deposited");
            partyYesDeposited = true;
        } else if (msg.sender == partyNo) {
            require(!partyNoDeposited, "Already deposited");
            partyNoDeposited = true;
        } else if (partyNo == address(0)) {
            // Open prediction — anyone can claim the NO side
            partyNo = msg.sender;
            partyNoDeposited = true;
            emit Matched(msg.sender);
        } else {
            revert("Not a party");
        }

        currency.safeTransferFrom(msg.sender, address(this), stakeAmount);
        emit Deposited(msg.sender, stakeAmount);

        if (partyYesDeposited && partyNoDeposited) {
            state = State.Funded;
        }
    }

    function initiateResolution(
        bytes calldata claim,
        bool _outcomeYes
    ) external nonReentrant onlyState(State.Funded) {
        require(block.timestamp >= deadline, "Before deadline");

        proposedOutcomeYes = _outcomeYes;

        uint256 bond = oo.getMinimumBond(address(currency));
        currency.forceApprove(address(oo), bond);

        assertionId = oo.assertTruth(
            claim,
            address(this),      // asserter
            address(this),      // callbackRecipient
            address(0),         // escalationManager (none)
            LIVENESS,
            currency,
            bond,
            oo.defaultIdentifier(),
            bytes32(0)          // domainId
        );

        state = State.Resolving;
        emit ResolutionInitiated(assertionId, _outcomeYes);
    }

    function assertionResolvedCallback(
        bytes32 _assertionId,
        bool assertedTruthfully
    ) external {
        require(msg.sender == address(oo), "Not oracle");
        require(_assertionId == assertionId, "Wrong assertion");
        require(state == State.Resolving, "Not resolving");

        if (assertedTruthfully) {
            resolvedYes = proposedOutcomeYes;
            state = State.Settled;

            address winner = resolvedYes ? partyYes : partyNo;
            uint256 payout = stakeAmount * 2;
            currency.safeTransfer(winner, payout);

            emit Settled(resolvedYes, winner);
        } else {
            // Disputed and lost — reset to allow retry
            state = State.Funded;
            assertionId = bytes32(0);
            emit DisputeReset();
        }
    }

    function assertionDisputedCallback(bytes32 _assertionId) external {
        // Required by UMA interface — no action needed
    }

    function expire() external nonReentrant {
        require(state == State.Created || state == State.Funded, "Cannot expire");
        require(block.timestamp >= deadline + EXPIRY_PERIOD, "Not expired yet");

        state = State.Expired;

        if (partyYesDeposited) {
            currency.safeTransfer(partyYes, stakeAmount);
        }
        if (partyNoDeposited) {
            currency.safeTransfer(partyNo, stakeAmount);
        }

        emit Expired();
    }

    function safeApprove(IERC20 token, address spender, uint256 amount) internal {
        // Not needed — using SafeERC20 directly
    }
}
