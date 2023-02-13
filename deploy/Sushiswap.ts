import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const deployFunction: DeployFunction = async function ({
  ethers,
  deployments,
  getNamedAccounts,
  getChainId,
}: HardhatRuntimeEnvironment) {
  console.log("Running Sushiswap deploy script");

  const { deploy, execute } = deployments;

  const { deployer } = await getNamedAccounts();

  const weth = await deployments.get("TestWETH");

  const sushiswapFactory = await deploy("UniswapV2Factory", {
    from: deployer,
    args: [weth.address],
  });

  const sushiswapRouter = await deploy("UniswapV2Router02", {
    from: deployer,
    args: [sushiswapFactory.address, weth.address],
  });

  console.log("Sushiswap factory deployed at ", sushiswapFactory.address);
  console.log("Sushiswap router deployed at ", sushiswapRouter.address);

  const bentoBox = await deploy("BentoBoxV1", {
    from: deployer,
    args: [weth.address],
  });

  const masterDeployer = await deploy("MasterDeployer", {
    from: deployer,
    args: [
      0, // barFee
      deployer, // barFeeTo
      bentoBox.address,
    ],
  });

  const cpPoolFactory = await deploy("ConstantProductPoolFactory", {
    from: deployer,
    args: [masterDeployer.address],
  });

  if (cpPoolFactory.newlyDeployed || masterDeployer.newlyDeployed) {
    await execute(
      "MasterDeployer",
      { from: deployer },
      "addToWhitelist",
      cpPoolFactory.address
    );
  }
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
