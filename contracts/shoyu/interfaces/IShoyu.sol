// SPDX-License-Identifier: MIT
pragma solidity >=0.8.13;

interface IShoyu {
    function cook(
        uint8[] memory adapterIds,
        uint256[] memory values,
        bytes[] memory datas
    ) payable external;
}
