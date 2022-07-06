module.exports = {
  skipFiles: [
    "seaport/",
    "sushiswap/",
    "test/",
  ],
  configureYulOptimizer: true,
  solcOptimizerDetails: {
    yul: true,
    yulDetails: {
      stackAllocation: true,
    },
  },
};
