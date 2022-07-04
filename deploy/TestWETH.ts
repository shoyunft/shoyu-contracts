import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const deployFunction: DeployFunction = async function ({
  ethers,
  deployments,
  getNamedAccounts,
}: HardhatRuntimeEnvironment) {
  console.log("Running TestWETH deploy script");

  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  await deploy("TestWETH", {
    from: deployer,
    deterministicDeployment: false,
  });

  const testWETH = await ethers.getContract("TestWETH");

  console.log("TestWETH deployed at ", testWETH.address);
};

export default deployFunction;

deployFunction.tags = ["DeployTestWETH"];

deployFunction.skip = ({ getChainId }) =>
  new Promise(async (resolve, reject) => {
    try {
      const chainId = await getChainId();
      resolve(chainId !== "31337");
    } catch (error) {
      reject(error);
    }
  });
