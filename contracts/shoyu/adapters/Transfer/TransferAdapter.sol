// SPDX-License-Identifier: MIT
pragma solidity >=0.8.7;

import "../../../lib/TokenTransferrer.sol";
import "./ConduitAdapter.sol";
import "./BentoAdapter.sol";
import { TokenSource } from "../../lib/ShoyuEnums.sol";

// TODO: Consider notice in TokenTransferrer.sol, maybe it shouldn't be used here
contract TransferAdapter is TokenTransferrer, ConduitAdapter, BentoAdapter {
    constructor(
        address _conduitController,
        address _bentoBox
    )
        ConduitAdapter(_conduitController)
        BentoAdapter(_bentoBox)
    {}

    function transferERC20From(
        address token,
        address to,
        uint256 amount,
        TokenSource source,
        bytes memory data
    ) public {
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
            revert("transferERC20From/INVALID_TOKEN_SOURCE");
        }
    }

    function transferERC721From(
        address token,
        address to,
        uint256 tokenId,
        TokenSource source,
        bytes memory data
    ) public {
        if (source == TokenSource.WALLET) {
            _performERC721Transfer(
                token,
                msg.sender,
                to,
                tokenId
            );
        } else if (source == TokenSource.CONDUIT) {
            bytes32 conduitKey = abi.decode(data, (bytes32));

            _performERC721TransferWithConduit(
                token,
                msg.sender,
                to,
                tokenId,
                conduitKey
            );
        } else {
            revert("transferERC721From/INVALID_TOKEN_SOURCE");
        }
    }

    function transferERC1155From(
        address token,
        address to,
        uint256 tokenId,
        uint256 amount,
        TokenSource source,
        bytes memory data
    ) public {
        if (source == TokenSource.WALLET) {
            _performERC1155Transfer(
                token,
                msg.sender,
                to,
                tokenId,
                amount
            );
        } else if (source == TokenSource.CONDUIT) {
           bytes32 conduitKey = abi.decode(data, (bytes32));

           _performERC1155TransferWithConduit(
                token,
                msg.sender,
                to,
                tokenId,
                amount,
                conduitKey
            );
        } else {
            revert("transferERC1155From/INVALID_TOKEN_SOURCE");
        }
    }

    /// @dev Transfers some amount of ETH to the given recipient and
    ///      reverts if the transfer fails.
    /// @param to The recipient of the ETH.
    /// @param amount The amount of ETH to transfer.
    function _transferEth(address payable to, uint256 amount)
        internal
    {
        assembly {
            let success := call(gas(), to, amount, 0, 0, 0, 0)
            if eq(success, 0) { revert(0, 0) }
        }
    }
}