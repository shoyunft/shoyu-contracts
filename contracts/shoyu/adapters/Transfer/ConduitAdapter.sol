// SPDX-License-Identifier: MIT
pragma solidity >=0.8.7;

import { ConduitControllerInterface } from "seaport/contracts/interfaces/ConduitControllerInterface.sol";
import { ConduitInterface } from "seaport/contracts/interfaces/ConduitInterface.sol";
import { ConduitTransfer } from "seaport/contracts/conduit/lib/ConduitStructs.sol";
import { ConduitItemType } from "seaport/contracts/conduit/lib/ConduitEnums.sol";

contract ConduitAdapter {
    // Allow for interaction with the conduit controller.
    ConduitControllerInterface private immutable _CONDUIT_CONTROLLER;
    // Cache the conduit creation hash used by the conduit controller.
    bytes32 private immutable _CONDUIT_CREATION_CODE_HASH;

    constructor(address _conduitController) {
        // Get the conduit creation code hash from the supplied conduit
        // controller and set it as an immutable.
        ConduitControllerInterface conduitController = ConduitControllerInterface(
            _conduitController
        );
        (_CONDUIT_CREATION_CODE_HASH, ) = conduitController.getConduitCodeHashes();

        // Set the supplied conduit controller as an immutable.
        _CONDUIT_CONTROLLER = conduitController;
    }

    /// @dev This function derives the conduit address from the deployer,
    ///      conduit key, and creation code hash.
    function _getConduit(bytes32 conduitKey) internal view returns (address conduit) {
        conduit = address(
            uint160(
                uint256(
                    keccak256(
                        abi.encodePacked(
                            bytes1(0xff),
                            address(_CONDUIT_CONTROLLER),
                            conduitKey,
                            _CONDUIT_CREATION_CODE_HASH
                        )
                    )
                )
            )
        );
    }

    /// @dev This function transfers an ERC20 using a Seaport
    ///      Conduit to source approval.
    /// @notice Only use `msg.sender` or `address(this)` in the from param.
    /// @param token        The ERC20 token to transfer.
    /// @param from         The originator of the transfer.
    /// @param to           The recipient of the transfer.
    /// @param amount       The amount of ERC20 to be sent.
    /// @param conduitKey   The key of the conduit to used.
    function _transferERC20WithConduit(
        address token,
        address from,
        address to,
        uint256 amount,
        bytes32 conduitKey
    ) internal {
        address conduit = _getConduit(conduitKey);

        ConduitTransfer[] memory conduitTransfers = new ConduitTransfer[](1);
        conduitTransfers[0] = ConduitTransfer(
            ConduitItemType.ERC20,
            token,
            from,
            to,
            0,
            amount
        );

        // Call the conduit and execute transfer.
        ConduitInterface(conduit).execute(conduitTransfers);
    }

    /// @dev This function transfers an ERC721 token using a Seaport
    ///      Conduit to source approval.
    /// @notice Only use `msg.sender` or `address(this)` in the from param.
    /// @param token        The ERC721 token to transfer.
    /// @param from         The originator of the transfer.
    /// @param to           The recipient of the transfer.
    /// @param tokenId      The tokenId of the ERC721 to be sent.
    /// @param conduitKey   The key of the conduit to used.
    function _transferERC721WithConduit(
        address token,
        address from,
        address to,
        uint256 tokenId,
        bytes32 conduitKey
    ) internal {
        address conduit = _getConduit(conduitKey);

        ConduitTransfer[] memory conduitTransfers = new ConduitTransfer[](1);
        conduitTransfers[0] = ConduitTransfer(
            ConduitItemType.ERC721,
            token,
            from,
            to,
            tokenId,
            1
        );

        // Call the conduit and execute transfer.
        ConduitInterface(conduit).execute(conduitTransfers);
    }

    /// @dev This function transfers an ERC1155 token using a Seaport
    ///      Conduit to source approval.
    /// @notice Only use `msg.sender` or `address(this)` in the from param.
    /// @param token        The ERC1155 token to transfer.
    /// @param from         The originator of the transfer.
    /// @param to           The recipient of the transfer.
    /// @param tokenId      The tokenId of the ERC1155 to be sent.
    /// @param amount       The amount of the ERC1155 to be sent.
    /// @param conduitKey   The key of the conduit to used.
    function _transferERC1155WithConduit(
        address token,
        address from,
        address to,
        uint256 tokenId,
        uint256 amount,
        bytes32 conduitKey
    ) internal {
        address conduit = _getConduit(conduitKey);

        ConduitTransfer[] memory conduitTransfers = new ConduitTransfer[](1);
        conduitTransfers[0] = ConduitTransfer(
            ConduitItemType.ERC1155,
            token,
            from,
            to,
            tokenId,
            amount
        );

        // Call the conduit and execute transfer.
        ConduitInterface(conduit).execute(conduitTransfers);
    }
}