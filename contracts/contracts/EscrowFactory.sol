// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./PredictionEscrow.sol";

contract EscrowFactory {
    address public immutable oo;
    address public immutable currency;

    address[] public escrows;

    event EscrowCreated(
        address indexed escrow,
        address indexed partyYes,
        address indexed partyNo,
        uint256 stakeAmount,
        uint256 deadline,
        string description
    );

    constructor(address _oo, address _currency) {
        require(_oo != address(0), "Invalid oracle");
        require(_currency != address(0), "Invalid currency");
        oo = _oo;
        currency = _currency;
    }

    function createEscrow(
        address partyYes,
        address partyNo,
        uint256 stakeAmount,
        uint256 deadline,
        string calldata description
    ) external returns (address) {
        PredictionEscrow escrow = new PredictionEscrow(
            partyYes,
            partyNo,
            stakeAmount,
            deadline,
            description,
            oo,
            currency
        );

        escrows.push(address(escrow));

        emit EscrowCreated(
            address(escrow),
            partyYes,
            partyNo,
            stakeAmount,
            deadline,
            description
        );

        return address(escrow);
    }

    function getEscrowCount() external view returns (uint256) {
        return escrows.length;
    }

    function getEscrow(uint256 index) external view returns (address) {
        return escrows[index];
    }
}
