import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { CONDUIT_CONTROLLER_ADDRESS } from "../constants/addresses";

const NONCE = "555555555555555";

const deployFunction: DeployFunction = async function ({
  ethers,
  deployments,
  getNamedAccounts,
  getChainId,
}: HardhatRuntimeEnvironment) {
  console.log("Running Conduit deploy script");

  const { save } = deployments;

  const { deployer } = await getNamedAccounts();

  const chainId = Number(await getChainId());

  let conduitController;

  if (chainId === 31337) {
    conduitController = await ethers.getContract("ConduitController");
  } else if (chainId in CONDUIT_CONTROLLER_ADDRESS) {
    conduitController = await ethers.getContractAt(
      "ConduitController",
      CONDUIT_CONTROLLER_ADDRESS[chainId]
    );
  } else {
    throw Error("No CONDUITCONTROLLER!");
  }

  const shoyu = await ethers.getContract("Shoyu");

  const conduitKey = `${deployer}${
    NONCE.length < 24 ? String(NONCE).padStart(24, "0") : NONCE.slice(0, 24)
  }`;

  const { conduit: conduitAddress, exists } =
    await conduitController.getConduit(conduitKey);

  if (exists) {
    console.log('reusing "Conduit" at', conduitAddress);
  } else {
    const { gasLimit } = await ethers.provider.getBlock("latest");

    const tx = await conduitController.createConduit(conduitKey, deployer, {
      gasLimit,
    });
    await tx.wait();

    await conduitController.updateChannel(conduitAddress, shoyu.address, true);

    console.log("Conduit deployed at address", conduitAddress);
  }

  try {
    await deployments.get("Conduit");
  } catch (e) {
    const artifact = await deployments.getExtendedArtifact("Conduit");
    await save("Conduit", { address: conduitAddress, ...artifact });
  }
};

export default deployFunction;

deployFunction.tags = ["DeployConduit"];

deployFunction.dependencies = ["DeployShoyu"];
