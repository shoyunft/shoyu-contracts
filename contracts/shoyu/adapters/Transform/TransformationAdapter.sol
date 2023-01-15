// SPDX-License-Identifier: MIT
pragma solidity >=0.8.11;

import "@sushiswap/core/contracts/uniswapv2/interfaces/IWETH.sol";
import "./SushiAdapter.sol";
import "./WETHAdapter.sol";

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