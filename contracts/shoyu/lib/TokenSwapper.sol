// SPDX-License-Identifier: MIT
pragma solidity >=0.8.7;

import "@sushiswap/core/contracts/uniswapv2/interfaces/IUniswapV2Pair.sol";
import "@sushiswap/core/contracts/uniswapv2/interfaces/IWETH.sol";
import "../../lib/TokenTransferrer.sol";

import { SwapExactOutDetails } from "./ShoyuStructs.sol";
import { pairFor, sortTokens, getAmountsIn } from "./LibSushi.sol";

contract TokenSwapper is TokenTransferrer {
    /// @dev The UniswapV2Factory address.
    address private immutable factory;
    /// @dev The UniswapV2 pair init code.
    bytes32 private immutable pairCodeHash;
    /// @dev WETH address
    address private immutable WETH;

    constructor(
        address _factory,
        bytes32 _pairCodeHash,
        address _weth
    ) {
        factory = _factory;
        pairCodeHash = _pairCodeHash;
        WETH = _weth;
    }

    function _performERC20TransferAndSwap(
        address from,
        uint256 amountOut,
        uint256 amountInMax,
        address[] memory path,
        address to
    ) internal returns (uint256 amountIn) {
        uint256[] memory amounts = getAmountsIn(
            factory,
            amountOut,
            path,
            pairCodeHash
        );
        amountIn = amounts[0];

        require(amountIn <= amountInMax, '_performERC20TransferAndSwap/EXCESSIVE_AMOUNT_IN');

        _performERC20Transfer(
            path[0],  // token
            from,     // from
            pairFor(
                factory,
                path[0],
                path[1],
                pairCodeHash
            ),          // to
            amountIn  // amount
        );

        _swap(amounts, path, to);
    }

    function _performSwapsForETH(
        SwapExactOutDetails[] memory swapDetails
    ) internal returns (uint256 ethAmount) {
        for (uint256 i = 0; i < swapDetails.length; i++) {
            require(
                swapDetails[i].path[swapDetails[i].path.length - 1] == WETH,
                "_performSwapsForETH/TOKEN_MISMATCH"
            );

            if (swapDetails[i].path.length == 1) {
                _performERC20Transfer(
                    WETH,
                    msg.sender,
                    address(this),
                    swapDetails[i].amountOut
                );
            } else {
                _performERC20TransferAndSwap(
                    msg.sender,
                    swapDetails[i].amountOut,
                    swapDetails[i].amountInMax,
                    swapDetails[i].path,
                    address(this)
                );
            }

            ethAmount = ethAmount + swapDetails[i].amountOut;
        }
        IWETH(WETH).withdraw(ethAmount);
    }

    // requires the initial amount to have already been sent to the first pair
    function _swap(
        uint256[] memory amounts,
        address[] memory path,
        address _to
    ) internal virtual {
        for (uint256 i; i < path.length - 1; i++) {
            (address input, address output) = (path[i], path[i + 1]);

            (address token0, ) = sortTokens(input, output);

            uint256 amountOut = amounts[i + 1];

            (uint256 amount0Out, uint256 amount1Out) = input == token0
                ? (uint256(0), amountOut)
                : (amountOut, uint256(0));
            address to = i < path.length - 2 ? pairFor(factory, output, path[i + 2], pairCodeHash) : _to;

            IUniswapV2Pair(pairFor(factory, input, output, pairCodeHash)).swap(
                amount0Out,
                amount1Out,
                to,
                new bytes(0)
            );
        }
    }

    /// @dev Transfers some amount of ETH to the given recipient and
    ///      reverts if the transfer fails.
    /// @param recipient The recipient of the ETH.
    /// @param amount The amount of ETH to transfer.
    function _transferEth(address payable recipient, uint256 amount)
        internal
    {
        if (amount > 0) {
            (bool success,) = recipient.call{value: amount}("");
            require(success, "_transferEth/TRANSFER_FAILED");
        }
    }
}