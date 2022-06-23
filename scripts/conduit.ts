import hre, { ethers } from "hardhat";
import readlineSync from "readline-sync";

import { CONDUIT_CONTROLLER_ADDRESS } from "../constants/addresses";

async function main() {
  const { deployer } = await ethers.getNamedSigners();

  const { chainId } = await ethers.provider.getNetwork();

  const conduitController = await ethers.getContractAt(
    "ConduitController",
    CONDUIT_CONTROLLER_ADDRESS[chainId]
  );

  const keyNonce = readlineSync.question("Conduit key nonce: ");

  const conduitKey = `${deployer.address}${
    keyNonce.length < 24
      ? String(keyNonce).padStart(24, "0")
      : keyNonce.slice(0, 24)
  }`;

  let { gasLimit } = await ethers.provider.getBlock("latest");
  if ((hre as any).__SOLIDITY_COVERAGE_RUNNING) {
    gasLimit = ethers.BigNumber.from(300_000_000);
  }

  console.log("Creating conduit");
  await conduitController
    .connect(deployer)
    .createConduit(conduitKey, deployer.address, { gasLimit });

  const { conduit: conduitAddress, exists } =
    await conduitController.getConduit(conduitKey);

  console.log("Created conduit");
  console.log("\t- address", conduitAddress);
  console.log("\t- key", conduitKey);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
