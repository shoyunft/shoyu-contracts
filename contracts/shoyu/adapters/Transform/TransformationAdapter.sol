pragma solidity >=0.8.11;

import "@sushiswap/core/contracts/uniswapv2/interfaces/IWETH.sol";
import "./LegacySwapAdapter.sol";

contract TransformationAdapter is LegacySwapAdapter {
    address private immutable WETH;

    constructor(
        address _weth,
        address _factory,
        bytes32 _pairCodeHash,
        address _conduitController,
        address _bentobox
    ) LegacySwapAdapter(_factory, _pairCodeHash, _conduitController, _bentobox) {
        WETH = _weth;
    }

    // transfers funds from msg.sender & performs swaps
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
                _transferEth(to, amountOut);
            }
        }
    }

    // requires path[0] to have been sent to address(this)
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
                _transferEth(to, amountOut);
            }
        }

    }

    // requires WETH to have been sent to address(this)
    function unwrapNativeToken(
        uint256 amount,
        address payable to
    ) public payable {
        IWETH(WETH).withdraw(amount);
        if (to != address(this)) {
            _transferEth(to, amount);
        }
    }

    // requires ETH to have been sent to address(this)
    function wrapNativeToken(uint256 amount) public payable {
        IWETH(WETH).deposit{value: amount}();
    }
}