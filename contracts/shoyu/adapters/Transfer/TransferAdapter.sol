// SPDX-License-Identifier: MIT
pragma solidity >=0.8.7;

import "../../../lib/TokenTransferrer.sol";
import "./ConduitAdapter.sol";
import "./BentoAdapter.sol";
import { TokenSource } from "../../lib/ShoyuEnums.sol";

contract TransferAdapter is TokenTransferrer, ConduitAdapter, BentoAdapter {
    constructor(
        address _conduitController,
        address _bentoBox
    )
        ConduitAdapter(_conduitController)
        BentoAdapter(_bentoBox)
    {}

    function _transferERC20(
        address token,
        address to,
        uint256 amount,
        TokenSource source,
        bytes memory data
    ) internal {
        if (source == TokenSource.WALLET) {
            _performERC20Transfer(
                token,
                msg.sender,
                to,
                amount
            ); 
        } else if (source == TokenSource.CONDUIT) {
            bytes32 conduitKey = abi.decode(data, (bytes32));

            _performERC20TransferWithConduit(
                token,
                msg.sender,
                to,
                amount,
                conduitKey
            );
        } else if (source == TokenSource.BENTO) {
            bool unwrapBento = abi.decode(data, (bool));

            _transferFromBentoBox(
                token,
                msg.sender,
                to,
                amount,
                0,
                unwrapBento
            );
        } else {
            revert("_transferERC20/INVALID_TOKEN_SOURCE");
        }
    }

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