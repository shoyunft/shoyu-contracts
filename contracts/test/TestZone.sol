// SPDX-License-Identifier: MIT
pragma solidity >=0.8.7;

import { ZoneInterface } from "seaport/contracts/interfaces/ZoneInterface.sol";

// prettier-ignore
import {
    AdvancedOrder,
    CriteriaResolver,
    ZoneParameters
} from "seaport/contracts/lib/ConsiderationStructs.sol";

contract TestZone is ZoneInterface {
        // Called by Consideration whenever any extraData is provided by the caller.
    function validateOrder(
        ZoneParameters calldata zoneParameters
    ) external returns (bytes4 validOrderMagicValue) {
        // revert(hex"696969696969");
        return ZoneInterface.validateOrder.selector;
    }
}
