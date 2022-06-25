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

    function swapExactOut(
        uint256 amountOut,
        uint256 amountInMax,
        address[] memory path,
        address payable to,
        TokenSource tokenSource,
        bytes memory transferData,
        bool unwrapNativeToken
    ) public payable {
        _legacySwapExactOut(
            amountOut,
            amountInMax,
            path,
            unwrapNativeToken ? address(this) : to,
            tokenSource,
            transferData
        );

        if (unwrapNativeToken) {
            IWETH(WETH).withdraw(amountOut);
            if (to != address(this)) {
                _transferEth(to, amountOut);
            }
        }
    }

    function unwrapNativeToken(
        uint256 amount,
        address payable to,
        TokenSource tokenSource,
        bytes memory transferData
    ) public payable {
        _transferERC20(
            WETH,
            address(this),
            amount,
            tokenSource,
            transferData
        );
        IWETH(WETH).withdraw(amount);
        if (to != address(this)) {
            _transferEth(to, amount);
        }
    }
}