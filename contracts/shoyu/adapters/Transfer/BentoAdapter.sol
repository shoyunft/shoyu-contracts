// SPDX-License-Identifier: GPL-3.0-or-later
/// @dev Adapted from: https://github.com/sushiswap/sushiXswap/blob/44057bca0b0a4c43002787fdc9cc90b760cf3682/contracts/adapters/BentoAdapter.sol

pragma solidity >=0.8.11;

import "@rari-capital/solmate/src/tokens/ERC20.sol";
import "@sushiswap/trident/contracts/interfaces/IBentoBoxMinimal.sol";

/// @title BentoAdapter
/// @notice Adapter which provides all functions of BentoBox require by this contract.
/// @dev These are generic functions, make sure, only msg.sender, address(this) and address(bentoBox)
/// are passed in the from param, or else the attacker can sifu user's funds in bentobox.
contract BentoAdapter {
    IBentoBoxMinimal public immutable bentoBox;

    /// @notice The user should use 0x0 if they want to use native currency, e.g., ETH.
    address constant USE_NATIVE = address(0);

    constructor(address _bentoBox) {
        bentoBox = IBentoBoxMinimal(_bentoBox);
    }

    /// @notice Deposits the token from users wallet into the BentoBox.
    /// @dev Make sure, only msg.sender, address(this) and address(bentoBox)
    /// are passed in the from param, or else the attacker can sifu user's funds in bentobox.
    /// Pass either amount or share.
    /// @param token token to deposit. Use token as address(0) when depositing native token
    /// @param from sender
    /// @param to receiver
    /// @param amount amount to be deposited
    function _depositToBentoBox(
        address token,
        address from,
        address to,
        uint256 amount
    ) internal {
        bentoBox.deposit{value: token == USE_NATIVE ? amount : 0}(token, from, to, amount, 0);
    }
}
