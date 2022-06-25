// SPDX-License-Identifier: MIT
pragma solidity >=0.8.7;

import "../../lib/TokenTransferrer.sol";
import { TokenSource } from "./ShoyuEnums.sol";

contract TransferHelper is TokenTransferrer {

    /// @dev Transfers some amount of ETH to the given recipient and
    ///      reverts if the transfer fails.
    /// @param recipient The recipient of the ETH.
    /// @param amount The amount of ETH to transfer.
    function _transferEth(address payable recipient, uint256 amount)
        internal
    {
        if (amount > 0) {
            (bool success,) = recipient.call{value: amount}("");
            require(success, "_transferEth/TRANSFER_FAILED");
        }
    }
}