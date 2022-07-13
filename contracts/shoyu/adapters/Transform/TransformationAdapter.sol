// SPDX-License-Identifier: MIT
pragma solidity >=0.8.11;

import "@sushiswap/core/contracts/uniswapv2/interfaces/IWETH.sol";
import "./LegacySwapAdapter.sol";

contract TransformationAdapter is LegacySwapAdapter {
    /// @dev The WETH address.
    address private immutable WETH;

    constructor(
        address _weth,
        address _factory,
        bytes32 _pairCodeHash,
        address _conduitController,
        address _bentobox
    ) LegacySwapAdapter(
        _factory,
        _pairCodeHash,
        _conduitController,
        _bentobox
    ) {
        WETH = _weth;
    }

    /// @dev This function swaps ERC20 tokens from msg.sender
    ///      for an exact amount of output tokens, sent
    ///      to the specified recipient.
    /// @param amountOut        The exact amount of output token to receive.
    /// @param amountInMax      The maximum amount of input to be spent.
    /// @param path             The swap path.
    /// @param to               The recipient to receive output token.
    /// @param tokenSource      The token / approval source for input token.
    /// @param transferData     Additional data required depending on `source`.
    /// @param unwrapNative     Flag to unwrap for native token if output token is WETH.
    function swapExactOut(
        uint256 amountOut,
        uint256 amountInMax,
        address[] memory path,
        address payable to,
        TokenSource tokenSource,
        bytes memory transferData,
        bool unwrapNative
    ) public payable {
        _legacySwapExactOut(
            amountOut,
            amountInMax,
            path,
            unwrapNative ? address(this) : to,
            tokenSource,
            transferData
        );

        if (unwrapNative) {
            IWETH(WETH).withdraw(amountOut);
            if (to != address(this)) {
                _transferETH(to, amountOut);
            }
        }
    }

    /// @dev This function swaps an exact amount of tokens from address(this)
    ///      and sends a mimimum amount of output token to the specified recipient.
    /// @param amountIn         The exact amount of input token to be spent.
    /// @param amountOutMin     The minimum amount of output token to be received.
    /// @param path             The swap path.
    /// @param to               The recipient of output token.
    /// @param unwrapNative     Flag to unwrap for native token if output token is WETH.
    function swapExactIn(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] memory path,
        address payable to,
        bool unwrapNative
    ) public payable {
        uint256 amountOut = _legacySwapExactIn(
            amountIn,
            amountOutMin,
            path,
            unwrapNative ? address(this) : to
        );

        if (unwrapNative) {
            IWETH(WETH).withdraw(amountOut);
            if (to != address(this)) {
                _transferETH(to, amountOut);
            }
        }
    }

    /// @dev This function performs the swaps as outlined in `path`. This contract's
    ///      entire balance of input token will be swapped for a minimum amount of
    ///      output token, sent to the specified recipient.
    /// @param amountOutMin     The minimum amount of output token to be received.
    /// @param path             The swap path.
    /// @param to               The recipient of output token.
    /// @param unwrapNative     Flag to unwrap for native token if output token is WETH.
    function swapMaxIn(
        uint256 amountOutMin,
        address[] memory path,
        address payable to,
        bool unwrapNative
    ) public payable {
        uint256 amountOut = _legacySwapExactIn(
            ERC20(path[0]).balanceOf(address(this)),
            amountOutMin,
            path,
            unwrapNative ? address(this) : to
        );

        if (unwrapNative) {
            IWETH(WETH).withdraw(amountOut);
            if (to != address(this)) {
                _transferETH(to, amountOut);
            }
        }

    }

    /// @dev This function unwraps WETH held by address(this)
    ///      and transfers ETH to the specified recipient.
    /// @param amount       The amount of WETH to be unwrapped.
    /// @param to           The ETH recipient.
    function unwrapNativeToken(
        uint256 amount,
        address payable to
    ) public payable {
        IWETH(WETH).withdraw(amount);
        if (to != address(this)) {
            _transferETH(to, amount);
        }
    }

    /// @dev This function wraps ETH held by address(this).
    /// @param amount       The amount of ETH to wrap
    function wrapNativeToken(uint256 amount) public payable {
        IWETH(WETH).deposit{value: amount}();
    }
}