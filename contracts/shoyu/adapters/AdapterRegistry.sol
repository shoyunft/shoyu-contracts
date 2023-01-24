// SPDX-License-Identifier: MIT
pragma solidity >=0.8.11;

import "@openzeppelin/contracts/access/Ownable.sol";
import { Adapter } from "../lib/LibShoyu.sol";

/// @title AdapterRegistry
/// @notice Registry of adapter contracts that can be invoked by the Shoyu contract. Only the
/// contract owner can update the registry.
/// @dev Any exposed function in an adapter contract should be marked as payable, even if the function
/// does not strictly require it. Since the Shoyu contract can receive ETH at any point during `cook`,
/// it is possible for `msg.value` to be greater than 0, causing a non-payable function to revert.
contract AdapterRegistry is Ownable {
    Adapter[] public adapters;

    constructor(
        uint256 length,
        address[] memory adapterAddress
    ) {
        for (uint256 i; i < length; ++i) {
            adapters.push(Adapter(adapterAddress[i], true));
        }
    }

    /// @dev This function allows the contract owner to set an address
    ///      for the specified adapter id.
    /// @param id               The id of the adapter to change.
    /// @param adapterAddress   The new adapter address.
    function setAdapterAddress(
        uint256 id,
        address adapterAddress
    ) external onlyOwner {
        Adapter storage adapter = adapters[id];
        adapter.adapterAddress = adapterAddress; 
    }

    /// @dev This function allows the contract owner to the update the
    ///      status of a given adapter id.
    /// @param id           The id of the adapter to update.
    /// @param isActive     The new active flag of given adapter.
    function setAdapterStatus(
        uint256 id,
        bool isActive
    ) external onlyOwner {
        Adapter storage adapter = adapters[id];
        adapter.isActive = isActive;
    }

    /// @dev This function allows the contract owner to add a new
    ///      adapter to the registry.
    /// @param adapterAddress   The address of the new adapter.
    function addAdapter(
        address adapterAddress
    ) external onlyOwner {
        adapters.push(Adapter(adapterAddress, true));
    }
}