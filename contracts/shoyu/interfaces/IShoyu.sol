// SPDX-License-Identifier: MIT
pragma solidity >=0.8.13;

import {
    SwapExactOutDetails,
    OrderDetails
} from "../lib/ShoyuStructs.sol";

interface IShoyu {
    function swapForETHAndFulfillOrders(
        SwapExactOutDetails[] calldata swapDetails,
        bytes calldata fulfillmentData,
        bytes32 conduitKey
    ) payable external;
}
