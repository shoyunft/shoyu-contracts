// SPDX-License-Identifier: MIT
pragma solidity >=0.8.7;

import "@sushiswap/core/contracts/uniswapv2/interfaces/IUniswapV2Pair.sol";
import "@rari-capital/solmate/src/tokens/ERC20.sol";

import "../Transfer/ConduitAdapter.sol";
import "../Transfer/TransferAdapter.sol";
import { SwapExactOutDetails } from "../../lib/ShoyuStructs.sol";
import { pairFor, sortTokens, getAmountsIn, getAmountsOut } from "../../lib/LibSushi.sol";
import { TokenSource } from "../../lib/ShoyuEnums.sol";

contract LegacySwapAdapter is TransferAdapter {
    /// @dev The UniswapV2Factory address.
    address private immutable factory;
    /// @dev The UniswapV2 pair init code.
    bytes32 private immutable pairCodeHash;

    constructor(
        address _factory,
        bytes32 _pairCodeHash,
        address _conduitController,
        address _bentobox
    ) TransferAdapter (_conduitController, _bentobox) {
        factory = _factory;
        pairCodeHash = _pairCodeHash;
    }

    // transfers funds from msg.sender and performs swap
    function _legacySwapExactOut(
        uint256 amountOut,
        uint256 amountInMax,
        address[] memory path,
        address to,
        TokenSource tokenSource,
        bytes memory transferData
    ) internal returns (uint256 amountIn) {
        uint256[] memory amounts = getAmountsIn(
            factory,
            amountOut,
            path,
            pairCodeHash
        );
        amountIn = amounts[0];

        require(amountIn <= amountInMax, '_legacySwapExactOut/EXCESSIVE_AMOUNT_IN');

        transferERC20From(
            path[0],
            pairFor(
                factory,
                path[0],
                path[1],
                pairCodeHash
            ),
            amountIn,
            tokenSource,
            transferData
        );

        _swap(amounts, path, to);
    }

    // requires path[0] to have already been sent to shoyuContract
    function _legacySwapExactIn(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] memory path,
        address to
    ) internal returns (uint256 amountOut) {
        uint256[] memory amounts = getAmountsOut(
            factory,
            amountIn,
            path,
            pairCodeHash
        );
        amountOut = amounts[amounts.length - 1];

        require(amountOut >= amountOutMin, "insufficient-amount-out");

        ERC20(path[0]).transfer(
            pairFor(
                factory,
                path[0],
                path[1],
                pairCodeHash
            ),
            amountIn
        );

        _swap(amounts, path, to);
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

    
}