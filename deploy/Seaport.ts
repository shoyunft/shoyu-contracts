import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/dist/types";

const deployFunction: DeployFunction = async function ({
  deployments,
  getNamedAccounts,
}: HardhatRuntimeEnvironment) {
  console.log("Running Seaport deploy script");
  const { deploy, execute } = deployments;

  const { deployer } = await getNamedAccounts();

  const conduitController = await deploy("ConduitController", {
    from: deployer,
  });

  const seaport = await deploy("Seaport", {
    from: deployer,
    args: [conduitController.address],
  });

  console.log("Seaport deployed at ", seaport.address);
};

export default deployFunction;

deployFunction.tags = ["DeploySeaport"];
