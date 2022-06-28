// // // SPDX-License-Identifier: MIT
pragma solidity >=0.8.11;

import "@rari-capital/solmate/src/tokens/ERC721.sol";

// TODO: is Ownable & setSeaportAddress
contract SeaportAdapter {
    address public immutable seaportAddress;

    constructor(address _seaportAddress) {
        seaportAddress = _seaportAddress;
    }

    function approveBeforeFulfill (
        address[] memory tokensToApprove,
        uint256 ethAmount,
        bytes memory data
    ) public payable returns (bool success, bytes memory returnData) {
        for (uint256 i; i < tokensToApprove.length; ++i) {
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

    function fulfill (
        uint256 ethAmount,
        bytes memory data
    ) public payable returns (bool success, bytes memory returnData) {
        (success, returnData) = seaportAddress.call{value: ethAmount}(data);

        if (!success) {
            assembly {
                returndatacopy(0, 0, returndatasize())
                revert(0, returndatasize())
            }
        }
    }
}