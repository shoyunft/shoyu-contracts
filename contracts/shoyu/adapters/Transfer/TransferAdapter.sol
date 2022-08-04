// SPDX-License-Identifier: MIT
pragma solidity >=0.8.7;

import "@rari-capital/solmate/src/tokens/ERC20.sol";
import "@rari-capital/solmate/src/tokens/ERC721.sol";
import "@rari-capital/solmate/src/tokens/ERC1155.sol";
import "./ConduitAdapter.sol";
import "./BentoAdapter.sol";
import { TokenSource } from "../../lib/LibShoyu.sol";

contract TransferAdapter is ConduitAdapter, BentoAdapter {
    constructor(
        address _conduitController,
        address _bentoBox
    )
        ConduitAdapter(_conduitController)
        BentoAdapter(_bentoBox)
    {}

    /// @dev Function to transfer ERC20 tokens from `msg.sender`
    ///      to a given recipient. Assets can be transferred from
    ///      a user's bentobox or wallet. If funds are transferred
    ///      from a user's wallet, approvals can be sourced from the
    ///      Shoyu contract or Seaport Conduit.
    /// @param token        The ERC20 token to transfer.
    /// @param to           The recipient of the transfer.
    /// @param amount       The amount to transfer.
    /// @param source       The token / approval source.
    /// @param data         Additional encoded data required depending on `source`.
    function transferERC20From(
        address token,
        address to,
        uint256 amount,
        TokenSource source,
        bytes memory data
    ) public {
        if (source == TokenSource.WALLET) {
            ERC20(token).transferFrom(msg.sender, to, amount);
        } else if (source == TokenSource.CONDUIT) {
            bytes32 conduitKey = abi.decode(data, (bytes32));

            _transferERC20WithConduit(
                token,
                msg.sender,
                to,
                amount,
                conduitKey
            );
        } else if (source == TokenSource.BENTO) {
            bool unwrapBento = abi.decode(data, (bool));

            _transferERC20FromBentoBox(
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

    /// @dev Function to transfer an ERC721 token from `msg.sender`
    ///      to a given recipient. Assets will be transferred from
    ///      a user's wallet with approvals being sourced from the
    ///      Shoyu contract or Seaport Conduit.
    /// @param token        The ERC721 token to transfer.
    /// @param to           The recipient of the transfer.
    /// @param tokenId      The tokenId of the asset to transfer.
    /// @param source       The NFT approval source.
    /// @param data         Additional encoded data required depending on `source`.
    function transferERC721From(
        address token,
        address to,
        uint256 tokenId,
        TokenSource source,
        bytes memory data
    ) public {
        if (source == TokenSource.WALLET) {
            ERC721(token).safeTransferFrom(
                msg.sender,
                to,
                tokenId
            );
        } else if (source == TokenSource.CONDUIT) {
            bytes32 conduitKey = abi.decode(data, (bytes32));

            _transferERC721WithConduit(
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

    /// @dev Function to transfer an ERC1155 token from `msg.sender`
    ///      to a given recipient. Assets will be transferred from
    ///      a user's wallet with approvals being sourced from the
    ///      Shoyu contract or Seaport Conduit.
    /// @param token        The ERC1155 token to transfer.
    /// @param to           The recipient of the transfer.
    /// @param tokenId      The tokenId of the asset to transfer.
    /// @param amount       The amount of the asset to transfer.
    /// @param source       The NFT approval source.
    /// @param data         Additional encoded data required depending on `source`.
    function transferERC1155From(
        address token,
        address to,
        uint256 tokenId,
        uint256 amount,
        TokenSource source,
        bytes memory data
    ) public {
        if (source == TokenSource.WALLET) {
            ERC1155(token).safeTransferFrom(
                msg.sender,
                to,
                tokenId,
                amount,
                "0x"
            );
        } else if (source == TokenSource.CONDUIT) {
           bytes32 conduitKey = abi.decode(data, (bytes32));

           _transferERC1155WithConduit(
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

    /// @dev Function to return any excess ERC20 tokens from address(this)
    ///      to `msg.sender`.
    /// @param token        The token to return to the caller.
    function returnERC20(address token) external {
        uint256 balance = ERC20(token).balanceOf(address(this));
        if (balance > 0) {
            ERC20(token).transfer(msg.sender, balance);
        }
    }

    /// @dev Function to return any left over ERC721 token from
    ///      address(this) to `msg.sender`.
    /// @param token        The token to return to the caller.
    /// @param tokenId      The token identifier of the asset.
    function returnERC721(address token, uint256 tokenId) external {
        if (ERC721(token).ownerOf(tokenId) == address(this)) {
            ERC721(token).transferFrom(address(this), msg.sender, tokenId);
        }
    }

    /// @dev Function to return any excess ERC1155 token from
    ///      address(this) to `msg.sender`.
    /// @param token        The token to return to the caller.
    /// @param tokenId      The token identifier of the asset.
    function returnERC1155(address token, uint256 tokenId) external {
        uint256 balance = ERC1155(token).balanceOf(address(this), tokenId);
        if (balance > 0) {
            ERC1155(token).safeTransferFrom(
                address(this),
                msg.sender,
                tokenId,
                balance,
                ""
            );
        }
    }

    /// @dev Transfers some amount of ETH to the given recipient and
    ///      reverts if the transfer fails.
    /// @param to       The recipient of the ETH.
    /// @param amount   The amount of ETH to transfer.
    function _transferETH(address payable to, uint256 amount) internal {
        assembly {
            let success := call(gas(), to, amount, 0, 0, 0, 0)
            if eq(success, 0) { revert(0, 0) }
        }
    }
}