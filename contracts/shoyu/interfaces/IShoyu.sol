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

    function retrieveETH(address to, uint256 amount) external;

    function retrieveERC20(address token, address to, uint256 amount) external;

    function retrieveERC721(
        address token,
        uint256[] calldata tokenIds,
        address to
    ) external;

    function retrieveERC1155(
        address token,
        uint256[] calldata tokenIds,
        uint256[] calldata amounts,
        address to
    ) external;
}