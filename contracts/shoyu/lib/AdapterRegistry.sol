// SPDX-License-Identifier: MIT
pragma solidity >=0.8.11;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/IAdapterRegistry.sol";
import { Adapter } from "./ShoyuStructs.sol";

contract AdapterRegistry is IAdapterRegistry, Ownable {
    Adapter[] public adapters;

    constructor(
        uint256 length,
        address[] memory adapterAddress,
        bool[] memory isLibrary
    ) {
        for (uint256 i; i < length; ++i) {
            adapters.push(Adapter(adapterAddress[i], isLibrary[i], true));
        }
    }

    function setAdapterAddress(
        uint256 id,
        address adapterAddress
    ) external onlyOwner {
        Adapter storage adapter = adapters[id];
        adapter.adapterAddress = adapterAddress; 
    }

    function setAdapterStatus(
        uint256 id,
        bool isActive
    ) external onlyOwner {
        Adapter storage adapter = adapters[id];
        adapter.isActive = isActive;
    }

    function addAdapter(
        address adapterAddress,
        bool isLibrary
    ) external onlyOwner {
        adapters.push(Adapter(adapterAddress, isLibrary, true));
    }
}