import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const deployFunction: DeployFunction = async function ({
  ethers,
  deployments,
  getNamedAccounts,
  getChainId,
}: HardhatRuntimeEnvironment) {
  console.log("Running Sushiswap deploy script");

  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  const weth = await deployments.get("TestWETH");

  const sushiswapFactory = await deploy("UniswapV2Factory", {
    from: deployer,
    args: [deployer],
  });

  const sushiswapRouter = await deploy("UniswapV2Router02", {
    from: deployer,
    args: [sushiswapFactory.address, weth.address],
  });

  const bentobox = await deploy("BentoBoxV1", {
    from: deployer,
    args: [weth.address],
  });

  console.log("Bentobox deployed at ", bentobox.address);
  console.log("Sushiswap factory deployed at ", sushiswapFactory.address);
  console.log("Sushiswap router deployed at ", sushiswapRouter.address);
};

export default deployFunction;

deployFunction.dependencies = ["DeployTestWETH"];

deployFunction.tags = ["DeploySushiswap"];

deployFunction.skip = ({ getChainId }) =>
  new Promise(async (resolve, reject) => {
    try {
      const chainId = await getChainId();
      resolve(chainId !== "31337");
    } catch (error) {
      reject(error);
    }
  });
