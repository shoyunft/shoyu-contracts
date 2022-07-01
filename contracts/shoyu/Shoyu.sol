// SPDX-License-Identifier: MIT
pragma solidity >=0.8.13;

import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@rari-capital/solmate/src/tokens/ERC20.sol";
import "./interfaces/IShoyu.sol";
import "./lib/AdapterRegistry.sol";
import "../sushiswap/IBentoBoxMinimal.sol";

contract Shoyu is IShoyu, Ownable, Pausable {
    AdapterRegistry public immutable adapterRegistry;

    constructor(address _adapterRegistery, address _bentobox) {
        adapterRegistry = AdapterRegistry(_adapterRegistery);
        IBentoBoxMinimal(_bentobox).registerProtocol();
    }

    function cook(
        uint8[] calldata adapterIds,
        uint256[] calldata values,
        bytes[] calldata datas
    ) external payable override whenNotPaused {
        uint256 length = adapterIds.length;
        for (uint256 i; i < length; ++i) {
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

    function approveERC20(
        address token,
        address operator,
        uint256 amount
    ) external onlyOwner {
        ERC20(token).approve(operator, amount);
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
