// SPDX-License-Identifier: MIT
pragma solidity >=0.8.13;

// Adapter from: https://github.com/sushiswap/limit-order/blob/a901749362691acd307f2370a876a33d33cde53e/contracts/libraries/UniswapV2Library.sol

import "@sushiswap/core/contracts/uniswapv2/interfaces/IUniswapV2Pair.sol";

// returns sorted token addresses, used to handle return values from pairs sorted in this order
function sortTokens(
    address tokenA,
    address tokenB
) pure returns (address token0, address token1) {
    require(tokenA != tokenB, 'UniswapV2Library: IDENTICAL_ADDRESSES');
    (token0, token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
    require(token0 != address(0), 'UniswapV2Library: ZERO_ADDRESS');
}

// calculates the CREATE2 address for a pair without making any external calls
function pairFor(
    address factory,
    address tokenA,
    address tokenB,
    bytes32 pairCodeHash
) pure returns (address pair) {
    (address token0, address token1) = sortTokens(tokenA, tokenB);
    pair = address(uint160(uint(keccak256(abi.encodePacked(
            hex'ff',
            factory,
            keccak256(abi.encodePacked(token0, token1)),
            pairCodeHash // init code hash
        )))));
}

// fetches and sorts the reserves for a pair
function getReserves(
    address factory,
    address tokenA,
    address tokenB,
    bytes32 pairCodeHash
) view returns (uint reserveA, uint reserveB) {
    (address token0,) = sortTokens(tokenA, tokenB);
    (uint reserve0, uint reserve1,) = IUniswapV2Pair(pairFor(factory, tokenA, tokenB, pairCodeHash)).getReserves();
    (reserveA, reserveB) = tokenA == token0 ? (reserve0, reserve1) : (reserve1, reserve0);
}

// given an input amount of an asset and pair reserves, returns the maximum output amount of the other asset
function getAmountOut(
    uint amountIn,
    uint reserveIn,
    uint reserveOut
) pure returns (uint amountOut) {
    require(amountIn > 0, 'UniswapV2Library: INSUFFICIENT_INPUT_AMOUNT');
    require(reserveIn > 0 && reserveOut > 0, 'UniswapV2Library: INSUFFICIENT_LIQUIDITY');
    uint amountInWithFee = amountIn* 997;
    uint numerator = amountInWithFee * reserveOut;
    uint denominator = reserveIn * 1000 + amountInWithFee;
    amountOut = numerator / denominator;
}

// given an output amount of an asset and pair reserves, returns a required input amount of the other asset
function getAmountIn(
    uint amountOut,
    uint reserveIn,
    uint reserveOut
) pure returns (uint amountIn) {
    require(amountOut > 0, 'UniswapV2Library: INSUFFICIENT_OUTPUT_AMOUNT');
    require(reserveIn > 0 && reserveOut > 0, 'UniswapV2Library: INSUFFICIENT_LIQUIDITY');
    uint numerator = reserveIn * amountOut * 1000;
    uint denominator = (reserveOut - amountOut) * 997;
    amountIn = numerator / denominator + 1;
}

// performs chained getAmountOut calculations on any number of pairs
function getAmountsOut(
    address factory,
    uint amountIn,
    address[] memory path,
    bytes32 pairCodeHash
) view returns (uint[] memory amounts) {
    require(path.length >= 2, 'UniswapV2Library: INVALID_PATH');
    amounts = new uint[](path.length);
    amounts[0] = amountIn;
    for (uint i; i < path.length - 1; i++) {
        (uint reserveIn, uint reserveOut) = getReserves(factory, path[i], path[i + 1], pairCodeHash);
        amounts[i + 1] = getAmountOut(amounts[i], reserveIn, reserveOut);
    }
}

// performs chained getAmountIn calculations on any number of pairs
function getAmountsIn(
    address factory,
    uint amountOut,
    address[] memory path,
    bytes32 pairCodeHash
) view returns (uint[] memory amounts) {
    require(path.length >= 2, 'UniswapV2Library: INVALID_PATH');
    amounts = new uint[](path.length);
    amounts[amounts.length - 1] = amountOut;
    for (uint i = path.length - 1; i > 0; i--) {
        (uint reserveIn, uint reserveOut) = getReserves(factory, path[i - 1], path[i], pairCodeHash);
        amounts[i - 1] = getAmountIn(amounts[i], reserveIn, reserveOut);
    }
}
