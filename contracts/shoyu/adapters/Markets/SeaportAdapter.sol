// SPDX-License-Identifier: MIT
pragma solidity >=0.8.11;

import "@rari-capital/solmate/src/tokens/ERC721.sol";

contract SeaportAdapter {
    address public immutable seaportAddress;

    constructor(address _seaportAddress) {
        seaportAddress = _seaportAddress;
    }

    /// @dev This function grants approval for NFTs held by address(this)
    ///      to Seaport contract before executing a fulfillment function.
    /// @param tokensToApprove      The tokens to approve before fulfilling the order(s).
    /// @param ethAmount            The amount of ETH to be sent when filling the order(s).
    /// @param data                 The Seaport encoded fulfillment data.
    function approveBeforeFulfill (
        address[] calldata tokensToApprove,
        uint256 ethAmount,
        bytes calldata data
    ) external payable returns (bool success, bytes memory returnData) {
        uint256 length = tokensToApprove.length;
        for (uint256 i; i < length; ++i) {
            if (!ERC721(tokensToApprove[i]).isApprovedForAll(address(this), seaportAddress)) {
                ERC721(tokensToApprove[i]).setApprovalForAll(seaportAddress, true);
            }
        }

        (success, returnData) = seaportAddress.call{value: ethAmount}(data);

        if (!success) {
            assembly {
                returndatacopy(0, 0, returndatasize())
                revert(0, returndatasize())
            }
        }
    }

    /// @dev This function calls a Seaport fulillment function using the given abi
    ///      encoded function data.
    /// @param ethAmount      The amount of ETH to be sent when calling the fulfillment function.
    /// @param data           The Seaport encoded fulfillment function data.
    function fulfill (
        uint256 ethAmount,
        bytes calldata data
    ) external payable returns (bool success, bytes memory returnData) {
        (success, returnData) = seaportAddress.call{value: ethAmount}(data);

        if (!success) {
            assembly {
                returndatacopy(0, 0, returndatasize())
                revert(0, returndatasize())
            }
        }
    }
}