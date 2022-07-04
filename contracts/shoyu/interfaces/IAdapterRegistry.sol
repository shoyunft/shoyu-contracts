// SPDX-License-Identifier: MIT
pragma solidity >=0.8.11;

import { Adapter } from "../lib/ShoyuStructs.sol";

interface IAdapterRegistry {
    function setAdapterAddress(
        uint256 id,
        address adapterAddress
    ) external;

    function setAdapterStatus(
        uint256 id,
        bool isActive
    ) external;

    function addAdapter(
        address adapterAddress,
        bool isLibrary
    ) external;
}