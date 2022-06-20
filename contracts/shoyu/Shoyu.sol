// SPDX-License-Identifier: MIT
pragma solidity >=0.8.13;

import "@sushiswap/core/contracts/uniswapv2/interfaces/IWETH.sol";

import "./interfaces/IShoyu.sol";
import "./lib/TokenSwapper.sol";

import {
    AdvancedOrder,
    CriteriaResolver,
    FulfillmentComponent
} from "../lib/ConsiderationStructs.sol";
import { ConsiderationInterface } from "../interfaces/ConsiderationInterface.sol";

contract Shoyu is IShoyu, TokenSwapper {
    address private immutable seaport;

    constructor(
        address _seaport,
        address _weth,
        address _factory,
        bytes32 _pairCodeHash
    ) TokenSwapper(_factory, _pairCodeHash, _weth) {
        seaport = _seaport;
    }

    function swapForETHAndFulfillOrders(
        SwapExactOutDetails[] memory swapDetails,
        bytes memory fulfillmentData
    ) external payable override {
        uint256 ethBefore = address(this).balance - msg.value;

        // Transfers tokens from `msg.sender` and swaps for ETH
        uint256 ethAvailable = _performSwapsForETH(swapDetails) + msg.value;

        (bool success, bytes memory resp) = seaport.call{value: ethAvailable}(fulfillmentData);

        require(success, "ORDER_NOT_FILLED");

        uint256 ethAfter = address(this).balance;

        require(ethAfter >= ethBefore, "CANNOT_USE_PREEXISTING_ETH_BALANCE");

        _transferEth(payable(msg.sender), ethAfter - ethBefore);
    }

    /// @dev Fallback for just receiving ether.
    receive() external payable {}
}
