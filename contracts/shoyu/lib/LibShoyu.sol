// SPDX-License-Identifier: MIT
pragma solidity >=0.8.13;

enum TokenSource {
    WALLET,
    CONDUIT
}

struct Adapter {
    address adapterAddress;
    bool isActive;
}