// SPDX-License-Identifier: MIT
pragma solidity >=0.8.13;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@rari-capital/solmate/src/tokens/ERC20.sol";
import "@rari-capital/solmate/src/tokens/ERC721.sol";
import "@rari-capital/solmate/src/tokens/ERC1155.sol";
import "./lib/AdapterRegistry.sol";
import "../sushiswap/IBentoBoxMinimal.sol";

contract Shoyu is Initializable, UUPSUpgradeable, OwnableUpgradeable, PausableUpgradeable {
    AdapterRegistry public adapterRegistry;

    function initialize(address _adapterRegistery, address _bentobox) initializer public {
        adapterRegistry = AdapterRegistry(_adapterRegistery);
        IBentoBoxMinimal(_bentobox).registerProtocol();

        __Ownable_init();
    }

    /// @dev This function executes a set of actions and allows composability
    ///      (contract calls) to other contracts that exist in AdapterRegistry.
    /// @param adapterIds   An array containing a sequence of ids of adapters to executed.
    /// @param datas        The encoded function data to be used when calling each adapter.
    function cook(
        uint8[] calldata adapterIds,
        bytes[] calldata datas
    ) external payable whenNotPaused {
        uint256 length = adapterIds.length;
        for (uint256 i; i < length; ++i) {
            (
                address adapterAddress,
                bool isActive
            ) = adapterRegistry.adapters(adapterIds[i]);

            require(isActive, "cook: inactive adapter");

            (bool success, ) = adapterAddress.delegatecall(datas[i]);

            if (!success) {
                assembly {
                    returndatacopy(0, 0, returndatasize())
                    revert(0, returndatasize())
                }
            }
        }

        _refundExcessETH();
    }

    /// @dev Internal function to return any left over ETH to `msg.sender`.
    function _refundExcessETH() internal {
        assembly {
            if gt(selfbalance(), 0) {
                let success := call(gas(), caller(), selfbalance(), 0, 0, 0, 0)
            }
        }
    }

    /// @dev This function is used by the contract owner to grant
    ///      ERC20 token approval to a specified operator.
    /// @param token        The ERC20 token to approve.
    /// @param operator     The operator to grant approval to.
    /// @param amount       The operator's allowance.
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

    // @dev Allows this contract to receive ERC721 tokens
    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external virtual returns (bytes4) {
        return 0x150b7a02;
    }

    // @dev Used by ERC721BasicToken.sol
    function onERC721Received(
        address,
        uint256,
        bytes calldata
    ) external virtual returns (bytes4) {
        return 0xf0b9e5ba;
    }

    /// @dev Required by UUPSUpgradeable
    function _authorizeUpgrade(address) internal override onlyOwner {}
}
