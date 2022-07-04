// SPDX-License-Identifier: MIT
pragma solidity >=0.8.13;

import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@rari-capital/solmate/src/tokens/ERC20.sol";
import "@rari-capital/solmate/src/tokens/ERC721.sol";
import "@rari-capital/solmate/src/tokens/ERC1155.sol";
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

    function approveERC20(
        address token,
        address operator,
        uint256 amount
    ) external onlyOwner {
        ERC20(token).approve(operator, amount);
    }

    function retrieveETH(address to, uint256 amount) onlyOwner external {
        _transferETH(to, amount);
    }

    function retrieveERC20(address token, address to, uint256 amount) onlyOwner external {
        ERC20(token).transfer(to, amount);
    }

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
