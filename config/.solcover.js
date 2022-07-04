module.exports = {
  skipFiles: [
    "seaport/Conduit.sol",
    "seaport/ConduitController.sol",
    "seaport/ImmutableCreate2FactoryInterface.sol",
    "seaport/Seaport.sol",
    "test/EIP1271Wallet.sol",
    "test/ExcessReturnDataRecipient.sol",
    "test/ERC1155BatchRecipient.sol",
    "test/Reenterer.sol",
    "test/TestERC1155.sol",
    "test/TestERC20.sol",
    "test/TestERC721.sol",
    "test/TestZone.sol",
    "test/TestWETH.sol"
  ],
  configureYulOptimizer: true,
  solcOptimizerDetails: {
    yul: true,
    yulDetails: {
      stackAllocation: true,
    },
  },
};
