// SPDX-License-Identifier: MIT
pragma solidity >=0.8.13;

import {
    SwapExactOutDetails,
    OrderDetails
} from "../lib/ShoyuStructs.sol";
import { TokenSource } from "../lib/ShoyuEnums.sol";

interface IShoyu {
    function cook(
        uint8[] memory actions,
        uint256[] memory values,
        bytes[] memory datas
    ) payable external;
}
