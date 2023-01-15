// SPDX-License-Identifier: MIT
pragma solidity >=0.8.7;

import "@sushiswap/core/contracts/uniswapv2/interfaces/IUniswapV2Pair.sol";
import "@sushiswap/trident/contracts/interfaces/IPool.sol";
import "../Transfer/BentoAdapter.sol";
import "../Transfer/ConduitAdapter.sol";
import "../Transfer/TransferAdapter.sol";
import {
    pairFor,
    sortTokens,
    getAmountsIn,
    getAmountsOut,
    ExactOutputParams,
    ExactInputParams
} from "../../lib/LibSushi.sol";
import { TokenSource } from "../../lib/LibShoyu.sol";

contract SushiAdapter is TransferAdapter, BentoAdapter {
    /// @dev The UniswapV2Factory address.
    address private immutable factory;
    /// @dev The UniswapV2 pair init code.
    bytes32 private immutable pairCodeHash;

    constructor(
        address _factory,
        bytes32 _pairCodeHash,
        address _bentobox,
        address _conduitController
    )
        BentoAdapter(_bentobox)
        TransferAdapter (_conduitController)
    {
        factory = _factory;
        pairCodeHash = _pairCodeHash;
    }

    /// @dev This function transfers the input token from msg.sender and
    ///      performs the swaps outlined in `params`. An exact amount of the
    ///      output token is sent to the specified recipient.
    /// @notice Swaps token A to token B directly. Swaps are done on `bento` tokens.
    /// @param params This includes the address of token A, pool, amount of token A to swap,
    /// minimum amount of token B after the swap and data required by the pool for the swap.
    /// @dev Ensure that the pool is trusted before calling this function. The pool can steal users' tokens.
    function tridentSwapExactOut(
        ExactOutputParams memory params,
        TokenSource tokenSource,
        bytes memory transferData
    ) external payable returns (uint256 amountIn) {
        amountIn = getAmountsIn(params.path, params.tokenOut, params.amountOut)[0];

        require(amountIn <= params.amountInMaximum, '_tridentSwapExactOut/EXCESSIVE_AMOUNT_IN');

        address tokenIn = abi.decode(params.path[0].data, (address));

        transferERC20From(
            tokenIn,
            address(bentoBox),
            amountIn,
            tokenSource,
            transferData
        );

        _depositToBentoBox(tokenIn, address(bentoBox), params.path[0].pool, amountIn);

        uint256 n = params.path.length;

        for (uint256 i = 0; i < n; ++i) {
            IPool(params.path[i].pool).swap(params.path[i].data);
        }

        // Call every pool in the path.
        // Pool `N` should transfer its output tokens to pool `N+1` directly.
        // The last pool should transfer its output tokens to the user.
        // If the user wants to unwrap `wETH`, the final destination should be this contract and
        // a batch call should be made to `unwrapWETH`.
        n = params.path.length;
        for (uint256 i = 0; i < n; ++i) {
            IPool(params.path[i].pool).swap(params.path[i].data);
        }
    }

    /// @notice Swaps token A to token B directly. Swaps are done on `bento` tokens.
    /// @param params This includes the address of token A, pool, amount of token A to swap,
    /// minimum amount of token B after the swap and data required by the pool for the swap.
    /// @dev Ensure that the pool is trusted before calling this function. The pool can steal users' tokens.
    function tridentSwapExactIn(ExactInputParams memory params) external payable returns (uint256 amountOut) {
        if (params.amountIn == 0) {
            params.amountIn = ERC20(params.tokenIn).balanceOf(address(this));
        }

        ERC20(params.tokenIn).transfer(
            address(bentoBox),
            params.amountIn
        );

        _depositToBentoBox(params.tokenIn, address(bentoBox), params.path[0].pool, params.amountIn);
    
        // Call every pool in the path.
        // Pool `N` should transfer its output tokens to pool `N+1` directly.
        // The last pool should transfer its output tokens to the user.
        // If the user wants to unwrap `wETH`, the final destination should be this contract and
        // a batch call should be made to `unwrapWETH`.
        uint256 n = params.path.length;
        for (uint256 i = 0; i < n; ++i) {
            amountOut = IPool(params.path[i].pool).swap(params.path[i].data);
        }
        // Ensure that the slippage wasn't too much. This assumes that the pool is honest.
        require(amountOut >= params.amountOutMinimum, "_tridentSwapExactIn/EXCESSIVE_AMOUNT_OUT");
    }

    /// @dev This function transfers the input token from msg.sender and
    ///      performs the swaps outlined in `path`. An exact amount of the
    ///      output token is sent to the specified recipient.
    /// @param amountOut        The exact amount of output token to receive.
    /// @param amountInMax      The maximum amount of input to be spent.
    /// @param path             The swap path.
    /// @param to               The recipient to receive output token.
    /// @param tokenSource      The token / approval source for input token.
    /// @param transferData     Additional data required depending on `source`.
    function legacySwapExactOut(
        uint256 amountOut,
        uint256 amountInMax,
        address[] memory path,
        address to,
        TokenSource tokenSource,
        bytes memory transferData
    ) external payable returns (uint256 amountIn) {
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

    /// @dev This function transfers an exact amount of the input token
    ///      from address(this) and performs the swaps outlined in `path`.
    ///      The output token is sent to the specified recipient.
    /// @param amountIn         The exact amount of input token to be spent.
    /// @param amountOutMin     The minimum amount of output token to be received.
    /// @param path             The swap path.
    /// @param to               The recipient of output token.
    function legacySwapExactIn(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] memory path,
        address to
    ) external payable returns (uint256 amountOut) {
        if (amountIn == 0) {
            amountIn = ERC20(path[0]).balanceOf(address(this));
        }

        uint256[] memory amounts = getAmountsOut(
            factory,
            amountIn,
            path,
            pairCodeHash
        );
        amountOut = amounts[amounts.length - 1];

        require(amountOut >= amountOutMin, "_legacySwapExactIn/EXCESSIVE_AMOUNT_OUT");

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

    /// @dev Performs swaps as outlined in `path` and sends the output
    ///      token to the specified recipient.
    /// @notice Requires the initial amount to have already been sent to the
    ///         first pair.
    /// @param amounts  The amounts to be swapped.
    /// @param path     The swap path.
    /// @param _to      The recipient of output token.
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