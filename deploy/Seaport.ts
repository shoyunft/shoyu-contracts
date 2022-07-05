import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { SEAPORT_ADDRESS } from "../constants/addresses";

const deployFunction: DeployFunction = async function ({
  ethers,
  deployments,
  getNamedAccounts,
  getChainId,
}: HardhatRuntimeEnvironment) {
  console.log("Running Seaport deploy script");

  const { save } = deployments;

  const chainId = Number(await getChainId());

  let seaport;

  if (chainId in SEAPORT_ADDRESS) {
    seaport = await ethers.getContractAt("Seaport", SEAPORT_ADDRESS[chainId]);
  } else {
    throw new Error("No SEAPORT!");
  }

  const artifact = await deployments.getExtendedArtifact("Seaport");
  await save("Seaport", { address: seaport.address, ...artifact });

  console.log('reusing "Seaport" deployment at', seaport.address);
};

export default deployFunction;

deployFunction.tags = ["SeaportDeployment"];
