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
    /// @param adapterIds   An array containing a sequence of adapterIds to execute.
    /// @param values       The ETH amounts to be sent along with each adapter execution.
    /// @param datas        The encoded function data to be used with each adapter execution.
    function cook(
        uint8[] calldata adapterIds,
        uint256[] calldata values,
        bytes[] calldata datas
    ) external payable whenNotPaused {
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

        _refundExcessETH();
    }

    function _transferETH(address to, uint256 amount) internal {
        assembly {
            let success := call(gas(), to, amount, 0, 0, 0, 0)
            if eq(success, 0) { revert(0, 0) }
        }
    }

    function _refundExcessETH() internal {
        uint256 balance = address(this).balance;
        if (balance > 0) {
            _transferETH(msg.sender, balance);
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

    /// @dev This function is used by the contract owner to retrieve ETH
    ///      that has been stuck in the contract.
    /// @param to           The recipient of the retrieved asset.
    /// @param amount       The amount of ETH to retrieve.
    function retrieveETH(address to, uint256 amount) onlyOwner external {
        _transferETH(to, amount);
    }

    /// @dev This function is used by the contract owner to retrieve ERC20
    ///      tokens that have become stuck in the contract.
    /// @param token        The ERC20 token to retrieve.
    /// @param to           The recipient of the retrieved asset.
    /// @param amount       The amount of ERC20 to retrieve.
    function retrieveERC20(address token, address to, uint256 amount) onlyOwner external {
        ERC20(token).transfer(to, amount);
    }

    /// @dev This function is used by the contract owner to retrieve ERC721
    ///      assets that have become stuck in the contract.
    /// @param token        The ERC721 token to retrieve.
    /// @param tokenIds     The tokenIds to retrieve.
    /// @param to           The recipient of the retrieved asset.
    function retrieveERC721(
        address token,
        uint256[] calldata tokenIds,
        address to
    ) onlyOwner external {
        uint256 length = tokenIds.length;
        for (uint256 i; i < length; ++i) {
            ERC721(token).safeTransferFrom(address(this), to, tokenIds[i]);
        }
    }

    /// @dev This function is used by the contract owner to retrieve ERC1155
    ///      assets that have become stuck in the contract.
    /// @param token        The ERC721 token to retrieve.
    /// @param tokenIds     The tokenIds to retrieve.
    /// @param amounts      The amounts of each tokenIds to retrieve.
    /// @param to           The recipient of the retrieved asset.
    function retrieveERC1155(
        address token,
        uint256[] calldata tokenIds,
        uint256[] calldata amounts,
        address to
    ) onlyOwner external {
        ERC1155(token).safeBatchTransferFrom(address(this), to, tokenIds, amounts, "");
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
