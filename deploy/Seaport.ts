import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import {
  CONDUIT_CONTROLLER_ADDRESS,
  SEAPORT_ADDRESS,
} from "../constants/addresses";

const deployFunction: DeployFunction = async function ({
  ethers,
  deployments,
  getNamedAccounts,
  getChainId,
}: HardhatRuntimeEnvironment) {
  console.log("Running Seaport deploy script");

  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  const chainId = Number(await getChainId());

  const conduitControllerAddress = CONDUIT_CONTROLLER_ADDRESS[chainId];

  const seaport = await deploy("Seaport", {
    from: deployer,
    args: [conduitControllerAddress],
  });

  console.log("Deployed seaport contract at ", seaport.address);
};

export default deployFunction;

deployFunction.tags = ["DeploySeaport"];

deployFunction.skip = ({ getChainId }) =>
  new Promise(async (resolve, reject) => {
    try {
      const chainId = Number(await getChainId());
      resolve(chainId in SEAPORT_ADDRESS);
    } catch (error) {
      reject(error);
    }
  });
