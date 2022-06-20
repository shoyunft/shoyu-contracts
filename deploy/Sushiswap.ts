import { WNATIVE_ADDRESS } from "@sushiswap/core-sdk";
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

  const chainId = Number(await getChainId());

  let wethAddress;

  if (chainId === 31337) {
    wethAddress = (await deployments.get("TestWETH")).address;
  } else if (chainId in WNATIVE_ADDRESS) {
    wethAddress = WNATIVE_ADDRESS[chainId];
  } else {
    throw Error("No WNATIVE!");
  }

  const sushiswapFactory = await deploy("UniswapV2Factory", {
    from: deployer,
    args: [deployer],
  });

  const sushiswapRouter = await deploy("UniswapV2Router02", {
    from: deployer,
    args: [sushiswapFactory.address, wethAddress],
  });

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
