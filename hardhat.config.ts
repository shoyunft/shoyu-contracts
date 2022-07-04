import * as dotenv from "dotenv";

import { HardhatUserConfig, subtask, task } from "hardhat/config";
import "@openzeppelin/hardhat-upgrades";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-ethers";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";
import "hardhat-deploy";
import "@tenderly/hardhat-tenderly";

import { TASK_COMPILE_SOLIDITY_GET_SOURCE_PATHS } from "hardhat/builtin-tasks/task-names";

dotenv.config();

let accounts;

if (process.env.PRIVATE_KEY) {
  accounts = [process.env.PRIVATE_KEY];
} else {
  accounts = {
    mnemonic:
      process.env.MNEMONIC ||
      "test test test test test test test test test test test junk",
  };
}

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (args, { ethers }) => {
  const accounts = await ethers.getSigners();

  for (const account of accounts) {
    console.log(await account.address);
  }
});

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.14",
        settings: {
          viaIR: true,
          optimizer: {
            enabled: true,
            runs: 19066,
          },
        },
      },
      {
        version: "0.6.12",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: "0.8.11",
        settings: {
          optimizer: {
            enabled: true,
            runs: 999999,
          },
        },
      },
    ],
    overrides: {
      "contracts/conduit/Conduit.sol": {
        version: "0.8.14",
        settings: {
          viaIR: true,
          optimizer: {
            enabled: true,
            runs: 1000000,
          },
        },
      },
      "contracts/conduit/ConduitController.sol": {
        version: "0.8.14",
        settings: {
          viaIR: true,
          optimizer: {
            enabled: true,
            runs: 1000000,
          },
        },
      },
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
  networks: {
    hardhat: {
      blockGasLimit: 30_000_000,
      throwOnCallFailures: false,
      allowUnlimitedContractSize: true,
    },
    goerli: {
      url: `https://goerli.infura.io/v3/${process.env.INFURA_API_KEY}`,
      accounts,
      chainId: 5,
      live: true,
      saveDeployments: true,
      tags: ["staging"],
    },
  },
  namedAccounts: {
    deployer: {
      default: 0,
    },
    alice: {
      default: 1,
    },
    bob: {
      default: 2,
    },
    carol: {
      default: 3,
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
  },
  // specify separate cache for hardhat, since it could possibly conflict with foundry's
  paths: { cache: "hh-cache" },
};

export default config;
