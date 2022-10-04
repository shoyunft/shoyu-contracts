// SPDX-License-Identifier: MIT
pragma solidity >=0.8.7;

import "@rari-capital/solmate/src/tokens/ERC20.sol";
import "@rari-capital/solmate/src/tokens/ERC721.sol";
import "@rari-capital/solmate/src/tokens/ERC1155.sol";
import "./ConduitAdapter.sol";
import { TokenSource } from "../../lib/LibShoyu.sol";

contract TransferAdapter is ConduitAdapter {
    constructor(address _conduitController) ConduitAdapter(_conduitController) {}

    /// @dev Function to transfer ERC20 tokens from `msg.sender`
    ///      to a given recipient. Assets can be transferred from
    ///      a user's wallet with approvals being sourced from
    ///      Shoyu contract or Shoyu's Seaport Conduit.
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
    ) public payable {
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
    ) public payable {
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
    ) public payable {
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
        }
    }

    /// @dev Function to return any excess ERC20 tokens from address(this)
    ///      to `msg.sender`.
    /// @param token        The token to return to the caller.
    function returnERC20(address token) external payable {
        uint256 balance = ERC20(token).balanceOf(address(this));
        if (balance > 0) {
            ERC20(token).transfer(msg.sender, balance);
        }
    }

    /// @dev Function to return any left over ERC721 token from
    ///      address(this) to `msg.sender`.
    /// @param token        The token to return to the caller.
    /// @param tokenId      The token identifier of the asset.
    function returnERC721(address token, uint256 tokenId) external payable {
        if (ERC721(token).ownerOf(tokenId) == address(this)) {
            ERC721(token).transferFrom(address(this), msg.sender, tokenId);
        }
    }

    /// @dev Function to return any excess ERC1155 token from
    ///      address(this) to `msg.sender`.
    /// @param token        The token to return to the caller.
    /// @param tokenId      The token identifier of the asset.
    function returnERC1155(address token, uint256 tokenId) external payable {
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
}