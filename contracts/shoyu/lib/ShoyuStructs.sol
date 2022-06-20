// SPDX-License-Identifier: MIT
pragma solidity >=0.8.7;

struct OrderDetails {
    uint256 value;
    bytes data;
}

struct SwapExactOutDetails {
    address[] path;
    uint256 amountInMax;
    uint256 amountOut;
}

struct SwapExactInDetails {
    address[] path;
    uint256 amountIn;
    uint256 amountOutMin;
}