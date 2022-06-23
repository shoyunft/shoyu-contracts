// SPDX-License-Identifier: MIT
pragma solidity >=0.8.7;

import "@sushiswap/core/contracts/uniswapv2/interfaces/IUniswapV2Pair.sol";
import "@sushiswap/core/contracts/uniswapv2/interfaces/IWETH.sol";
import "../../lib/TokenTransferrer.sol";

import { SwapExactOutDetails } from "./ShoyuStructs.sol";
import { pairFor, sortTokens, getAmountsIn } from "./LibSushi.sol";
import { ConduitControllerInterface } from "../../interfaces/ConduitControllerInterface.sol";
import { ConduitTransfer } from "../../conduit/lib/ConduitStructs.sol";
import { ConduitInterface } from "../../interfaces/ConduitInterface.sol";
import { ConduitItemType } from "../../conduit/lib/ConduitEnums.sol";

contract TokenSwapper is TokenTransferrer {
    /// @dev The UniswapV2Factory address.
    address private immutable factory;
    /// @dev The UniswapV2 pair init code.
    bytes32 private immutable pairCodeHash;
    /// @dev WETH address
    address private immutable WETH;
    // Allow for interaction with the conduit controller.
    ConduitControllerInterface private immutable _CONDUIT_CONTROLLER;
    // Cache the conduit creation hash used by the conduit controller.
    bytes32 private immutable _CONDUIT_CREATION_CODE_HASH;

    constructor(
        address _factory,
        bytes32 _pairCodeHash,
        address _weth,
        address _conduitController
    ) {
        factory = _factory;
        pairCodeHash = _pairCodeHash;
        WETH = _weth;
        // Get the conduit creation code hash from the supplied conduit
        // controller and set it as an immutable.
        ConduitControllerInterface conduitController = ConduitControllerInterface(
            _conduitController
        );
        (_CONDUIT_CREATION_CODE_HASH, ) = conduitController.getConduitCodeHashes();

        // Set the supplied conduit controller as an immutable.
        _CONDUIT_CONTROLLER = conduitController;
    }

    function _performERC20TransferAndSwap(
        address from,
        uint256 amountOut,
        uint256 amountInMax,
        address[] memory path,
        address to,
        bytes32 conduitKey
    ) internal returns (uint256 amountIn) {
        uint256[] memory amounts = getAmountsIn(
            factory,
            amountOut,
            path,
            pairCodeHash
        );
        amountIn = amounts[0];

        require(amountIn <= amountInMax, '_performERC20TransferAndSwap/EXCESSIVE_AMOUNT_IN');

        if (conduitKey == bytes32(0)) {
            _performERC20Transfer(
                path[0],  // token
                from,     // from
                pairFor(
                    factory,
                    path[0],
                    path[1],
                    pairCodeHash
                ),          // to
                amountIn  // amount
            );
        } else {
            _performERC20TransferWithConduit(
                path[0],
                from,
                pairFor(
                    factory,
                    path[0],
                    path[1],
                    pairCodeHash
                ),
                amountIn,
                conduitKey
            );
        }

        _swap(amounts, path, to);
    }

    function _performSwapsForETH(
        SwapExactOutDetails[] memory swapDetails,
        bytes32 conduitKey
    ) internal returns (uint256 ethAmount) {
        for (uint256 i = 0; i < swapDetails.length; i++) {
            require(
                swapDetails[i].path[swapDetails[i].path.length - 1] == WETH,
                "_performSwapsForETH/TOKEN_MISMATCH"
            );

            if (swapDetails[i].path.length == 1) {
                if (conduitKey == bytes32(0)) {
                    _performERC20Transfer(
                        WETH,
                        msg.sender,
                        address(this),
                        swapDetails[i].amountOut
                    );
                } else {
                    _performERC20TransferWithConduit(
                        WETH,
                        msg.sender,
                        address(this),
                        swapDetails[i].amountOut,
                        conduitKey
                    );
                }
            } else {
                _performERC20TransferAndSwap(
                    msg.sender,
                    swapDetails[i].amountOut,
                    swapDetails[i].amountInMax,
                    swapDetails[i].path,
                    address(this),
                    conduitKey
                );
            }

            ethAmount = ethAmount + swapDetails[i].amountOut;
        }
        IWETH(WETH).withdraw(ethAmount);
    }

    function _performERC20TransferWithConduit(
        address token,
        address from,
        address to,
        uint256 amount,
        bytes32 conduitKey
    ) internal returns (uint256 ethAmount) {
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

    // requires the initial amount to have already been sent to the first pair
    function _swap(
        uint256[] memory amounts,
        address[] memory path,
        address _to
    ) internal virtual {
        for (uint256 i; i < path.length - 1; i++) {
            (address input, address output) = (path[i], path[i + 1]);

            (address token0, ) = sortTokens(input, output);

            uint256 amountOut = amounts[i + 1];

            (uint256 amount0Out, uint256 amount1Out) = input == token0
                ? (uint256(0), amountOut)
                : (amountOut, uint256(0));
            address to = i < path.length - 2 ? pairFor(factory, output, path[i + 2], pairCodeHash) : _to;

            IUniswapV2Pair(pairFor(factory, input, output, pairCodeHash)).swap(
                amount0Out,
                amount1Out,
                to,
                new bytes(0)
            );
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