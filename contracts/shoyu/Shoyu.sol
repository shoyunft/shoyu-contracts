// SPDX-License-Identifier: MIT
pragma solidity >=0.8.13;

import "./interfaces/IShoyu.sol";
import "./lib/AdapterRegistry.sol";

contract Shoyu is IShoyu {
    AdapterRegistry public immutable adapterRegistry;

    constructor(address _adapterRegistery) {
        adapterRegistry = AdapterRegistry(_adapterRegistery);
    }

    function cook(
        uint8[] memory adapterIds,
        uint256[] memory values,
        bytes[] memory datas
    ) public payable override {
        uint256 length = adapterIds.length;
        for (uint256 i; i < length; i = ++i) {
            (
                address adapterAddress,
                bool isLibrary,
                bool isActive
            ) = adapterRegistry.adapters(adapterIds[i]);

            require(isActive, "cook: inactive adapter");

            (bool success, ) = isLibrary ? adapterAddress.delegatecall(datas[i])
                : adapterAddress.call{value: values[i]}(datas[i]);

            if (!success) {
                assembly {
                    returndatacopy(0, 0, returndatasize())
                    revert(0, returndatasize())
                }
            }
        }

        // refund excess ETH
        assembly {
            if gt(selfbalance(), 0) {
                let callStatus := call(
                    gas(),
                    caller(),
                    selfbalance(),
                    0,
                    0,
                    0,
                    0
                )
            }
        }
    }

    /// @dev Fallback for just receiving ether.
    receive() external payable {}

    /// @dev Allows this contract to receive ERC1155 tokens
    ///      TODO: is this required for ERC721 too?
    function onERC1155Received(
        address,
        address,
        uint256,
        uint256,
        bytes calldata
    ) public virtual returns (bytes4) {
        return this.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(
        address,
        address,
        uint256[] calldata,
        uint256[] calldata,
        bytes calldata
    ) public virtual returns (bytes4) {
        return this.onERC1155BatchReceived.selector;
    }
}
