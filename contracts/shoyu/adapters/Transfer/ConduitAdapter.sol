// SPDX-License-Identifier: MIT
pragma solidity >=0.8.7;

import { ConduitControllerInterface } from "../../../interfaces/ConduitControllerInterface.sol";
import { ConduitInterface } from "../../../interfaces/ConduitInterface.sol";
import { ConduitTransfer } from "../../../conduit/lib/ConduitStructs.sol";
import { ConduitItemType } from "../../../conduit/lib/ConduitEnums.sol";

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

    function _performERC20TransferWithConduit(
        address token,
        address from,
        address to,
        uint256 amount,
        bytes32 conduitKey
    ) internal {
        // Derive the conduit address from the deployer, conduit key
        // and creation code hash.
        address conduit = address(
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

    function _performERC721TransferWithConduit(
        address token,
        address from,
        address to,
        uint256 tokenId,
        bytes32 conduitKey
    ) internal {
        // Derive the conduit address from the deployer, conduit key
        // and creation code hash.
        address conduit = address(
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

    function _performERC1155TransferWithConduit(
        address token,
        address from,
        address to,
        uint256 tokenId,
        uint256 amount,
        bytes32 conduitKey
    ) internal {
        // Derive the conduit address from the deployer, conduit key
        // and creation code hash.
        address conduit = address(
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