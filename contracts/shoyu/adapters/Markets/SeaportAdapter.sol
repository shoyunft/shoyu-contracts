// SPDX-License-Identifier: MIT
pragma solidity >=0.8.11;

import "@rari-capital/solmate/src/tokens/ERC721.sol";
import "seaport/contracts/interfaces/ConsiderationInterface.sol";

/// @title SeaportAdapter
/// @notice Adapter which provides all order fulfillment functions of Seaport required by this contract.
/// @dev When filling an Seaport order and the consideration items include one or more NFTs, use
/// `approveBeforeFulfill` or `approveBeforeFulfillBatch` if the Shoyu contract has not already
/// granted approval of the asset(s) to the Seaport contract.
contract SeaportAdapter {
    address public immutable seaportAddress;

    bytes4 private constant fulfillAdvancedOrderSelector = ConsiderationInterface.fulfillAdvancedOrder.selector;
    bytes4 private constant fulfillAvailableAdvancedOrdersSelector = ConsiderationInterface.fulfillAvailableAdvancedOrders.selector;

    constructor(address _seaportAddress) {
        seaportAddress = _seaportAddress;
    }

    /// @dev This function grants approval for NFTs held by address(this)
    ///      to Seaport contract before fulfilling a single order by
    ///      calling `fulfillAdvancedOrder()`.
    /// @param tokensToApprove      The tokens to approve before fulfilling the order.
    /// @param ethAmount            The amount of ETH to be sent when filling the order.
    /// @param data                 The Seaport encoded fulfillment data.
    function approveBeforeFulfill (
        address[] calldata tokensToApprove,
        uint256 ethAmount,
        bytes calldata data
    ) external payable {
        uint256 length = tokensToApprove.length;
        for (uint256 i; i < length; ++i) {
            ERC721 token = ERC721(tokensToApprove[i]);
            if (!token.isApprovedForAll(address(this), seaportAddress)) {
                token.setApprovalForAll(seaportAddress, true);
            }
        }

        fulfill(ethAmount, data);
    }

    /// @dev This function grants approval for NFTs held by address(this)
    ///      to Seaport contract before fulfilling multiple orders by
    ///      calling `fulfillAvailableAdvancedOrders()`
    /// @param tokensToApprove      The tokens to approve before fulfilling the orders.
    /// @param ethAmount            The amount of ETH to be sent when filling the orders.
    /// @param data                 The ABI encoded params.
    /// @param revertIfIncomplete   Flag to revert if one or more orders cannot be fulfilled.
    function approveBeforeFulfillBatch (
        address[] calldata tokensToApprove,
        uint256 ethAmount,
        bytes calldata data,
        bool revertIfIncomplete
    ) external payable {
        uint256 length = tokensToApprove.length;
        for (uint256 i; i < length; ++i) {
            ERC721 token = ERC721(tokensToApprove[i]);
            if (!token.isApprovedForAll(address(this), seaportAddress)) {
                token.setApprovalForAll(seaportAddress, true);
            }
        }

        fulfillBatch(ethAmount, data, revertIfIncomplete);
    }

    /// @dev This function calls `fulfillAdvancedOrder()` on Seaport
    ///      using the given abi encoded params.
    /// @param ethAmount      The amount of ETH to be sent when fulfilling the order.
    /// @param data           The ABI encoded params.
    function fulfill (
        uint256 ethAmount,
        bytes calldata data
    ) public payable {
        (bool success, bytes memory results) =
            seaportAddress.call{
                value: ethAmount
            }(abi.encodePacked(fulfillAdvancedOrderSelector, data));

        require(success && abi.decode(results, (bool)) , "fullfill/SEAPORT_ORDER_UNFILLABLE");
    }

    /// @dev This function calls `fulfillAvailableAdvancedOrders()` on
    ///      Seaport using the given abi encoded params.
    /// @param ethAmount            The amount of ETH to be sent when calling the fulfillment function.
    /// @param data                 The ABI encoded params.
    /// @param revertIfIncomplete   Flag to revert if one or more orders cannot be fulfilled.
    function fulfillBatch (
        uint256 ethAmount,
        bytes calldata data,
        bool revertIfIncomplete
    ) public payable {
        (bool success, bytes memory results) =
            seaportAddress.call{value: ethAmount}(
                abi.encodePacked(fulfillAvailableAdvancedOrdersSelector, data)
            );

        require(success, "fullfillBatch/SEAPORT_REVERTED");

        if (revertIfIncomplete) {
            (bool[] memory availableOrders,) = abi.decode(results, (bool[], Execution[]));
            uint256 length = availableOrders.length;
            for (uint256 i; i < length; ++i) {
                require(
                    availableOrders[i],
                    "fulfillBatch/SEAPORT_ORDER_UNFILLABLE"
                );
            }
        }
    }
}