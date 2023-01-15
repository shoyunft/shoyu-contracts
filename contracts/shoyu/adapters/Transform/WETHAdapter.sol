// SPDX-License-Identifier: MIT
pragma solidity >=0.8.11;

import "@sushiswap/core/contracts/uniswapv2/interfaces/IWETH.sol";
import "@rari-capital/solmate/src/tokens/ERC20.sol";

contract WETHAdapter {
    /// @dev The WETH address.
    address private immutable WETH;

    constructor(address _weth) {
        WETH = _weth;
    }

    /// @dev This function unwraps WETH held by address(this)
    ///      and transfers ETH to the specified recipient.
    /// @param amount       The amount of WETH to be unwrapped.
    /// @param to           The ETH recipient.
    function unwrapNativeToken(
        uint256 amount,
        address payable to
    ) external payable {
        amount = amount == 0 ? ERC20(WETH).balanceOf(address(this)) : amount;
        IWETH(WETH).withdraw(amount);

        if (to != address(this)) {
            to.transfer(amount);
        }
    }

    /// @dev This function wraps ETH held by address(this).
    /// @param amount       The amount of ETH to wrap
    function wrapNativeToken(uint256 amount) external payable {
        IWETH(WETH).deposit{value: amount == 0 ? address(this).balance : amount}();
    }
}