# ShoyuNFT [![Coverage Status](https://coveralls.io/repos/github/shoyunft/shoyu-contracts/badge.svg)](https://coveralls.io/github/shoyunft/shoyu-contracts)

The purpose of the ShoyuNFT contracts is to add features of Sushi products to NFT marketplaces.

The main point of entry is the `cook()` function, which allows a user to provide a sequence of actions to be executed. Each action is composed of an adapter identifier and the ABI encoded function data to be executed. The adapter identifier refers to the index of the contract in the `AdapterRegistry` which contains the implentation for the given action.

Currently the `AdapterRegistry` contains 2 entries:

1. `TransformationAdapter`
   - Responsible for transfers, swapping ERC20s, wrapping/unwrapping ETH.
   - Composed of multiple Adapters
     - `TransferAdapter`
       - Includes functions to transfer tokens from the caller's wallet or from Shoyu contract. Users can utilize Shoyu's Seaport Conduit when transferring assets from their wallet.
     - `LegacySwapAdapter`
       - Swaps ERC20s via Sushiswap legacy pools.
2. `SeaportAdapter`
   - Fulfills a single or multiple orders on Seaport.

Example use cases:

- Purchase one or many listed NFTs with combination of ETH & ERC20s
- Accept one or many offers on NFTs and receive any ERC20/ETH

When more marketplaces are supported, it will be possible to trade across multiple markets in a single transaction. For example,

- NFT AMM has floor price at 1.5ETH
- Seaport order has item listed for 1.0 ETH
- User could buy the item on Seaport and sell it to AMM, while taking profits in a single transaction.

## Install

To install dependencies and compile contracts:

```bash
git clone https://github.com/shoyunft/shoyu-contracts && cd shoyu-contracts
yarn install
yarn build
```

## Usage

To run hardhat tests written in javascript:

```bash
yarn test
yarn coverage
```
