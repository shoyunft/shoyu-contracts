// SPDX-License-Identifier: MIT
pragma solidity >=0.8.11;

import "@sushiswap/core/contracts/uniswapv2/interfaces/IWETH.sol";
import "./SushiAdapter.sol";
import "./WETHAdapter.sol";

/// @title TransformationAdapter
/// @notice This adapter combines SushiAdapter & WETHAdapter to provide a single
/// contract from which trasfer or transformation functions can be invoked.
contract TransformationAdapter is SushiAdapter, WETHAdapter {
    constructor(
        address _weth,
        address _factory,
        bytes32 _pairCodeHash,
        address _bentobox,
        address _conduitController
    )
        WETHAdapter(_weth) 
        SushiAdapter(
            _factory,
            _pairCodeHash,
            _bentobox,
            _conduitController
        )
    {}
}