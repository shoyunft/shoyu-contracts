import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import {
  CONDUIT_CONTROLLER_ADDRESS,
  SEAPORT_ADDRESS,
} from "../constants/addresses";

const NONCE = "000000000000000";

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

  let conduitController, seaportAddress;

  if (chainId === 31337) {
    conduitController = await ethers.getContract("ConduitController");
    seaportAddress = (await ethers.getContract("Seaport")).address;
  } else if (
    chainId in CONDUIT_CONTROLLER_ADDRESS &&
    chainId in SEAPORT_ADDRESS
  ) {
    conduitController = await ethers.getContractAt(
      "ConduitController",
      CONDUIT_CONTROLLER_ADDRESS[chainId]
    );
    seaportAddress = SEAPORT_ADDRESS[chainId];
  } else {
    throw Error("No CONDUITCONTROLLER!");
  }

  const shoyu = await ethers.getContract("Shoyu");

  const conduitKey = `${deployer}${
    NONCE.length < 24 ? String(NONCE).padStart(24, "0") : NONCE.slice(0, 24)
  }`;

  const { conduit: conduitAddress, exists } =
    await conduitController.getConduit(conduitKey);

  console.log("ConduitKey:", conduitKey);

  if (exists) {
    console.log('reusing "Conduit" at', conduitAddress);
  } else {
    const { gasLimit } = await ethers.provider.getBlock("latest");

    let tx = await conduitController.createConduit(conduitKey, deployer, {
      gasLimit,
    });
    await tx.wait();

    tx = await conduitController.updateChannel(
      conduitAddress,
      seaportAddress,
      true
    );
    await tx.wait();

    tx = await conduitController.updateChannel(
      conduitAddress,
      shoyu.address,
      true
    );
    await tx.wait();

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
