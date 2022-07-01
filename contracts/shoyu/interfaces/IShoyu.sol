// SPDX-License-Identifier: MIT
pragma solidity >=0.8.13;

interface IShoyu {
    function cook(
        uint8[] calldata adapterIds,
        uint256[] calldata values,
        bytes[] calldata datas
    ) payable external;

    function approveERC20(
        address token,
        address operator,
        uint256 amount
    ) external;
}
