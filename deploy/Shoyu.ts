import {
  FACTORY_ADDRESS,
  INIT_CODE_HASH,
  WNATIVE_ADDRESS,
} from "@sushiswap/core-sdk";
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
  console.log("Running Shoyu deploy script");

  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  const chainId = Number(await getChainId());

  let wethAddress, pairCodeHash, sushiswapFactory, seaport;

  if (chainId === 31337) {
    wethAddress = (await deployments.get("TestWETH")).address;
  } else if (chainId in WNATIVE_ADDRESS) {
    wethAddress = WNATIVE_ADDRESS[chainId];
  } else {
    throw Error("No WNATIVE!");
  }

  if (chainId === 31337) {
    sushiswapFactory = await ethers.getContract("UniswapV2Factory");
  } else if (chainId in FACTORY_ADDRESS) {
    sushiswapFactory = await ethers.getContractAt(
      "UniswapV2Factory",
      FACTORY_ADDRESS[chainId]
    );
  } else {
    throw Error("No FACTORY!");
  }

  if (chainId === 31337) {
    pairCodeHash = await sushiswapFactory.pairCodeHash();
  } else if (chainId in INIT_CODE_HASH) {
    pairCodeHash = INIT_CODE_HASH[chainId];
  } else {
    throw Error("No INIT_CODE_HASH!");
  }

  if (chainId in SEAPORT_ADDRESS) {
    seaport = await ethers.getContractAt("Seaport", SEAPORT_ADDRESS[chainId]);
  } else {
    seaport = await deployments.get("Seaport");
  }

  const shoyu = await deploy("Shoyu", {
    from: deployer,
    args: [
      seaport.address,
      wethAddress,
      sushiswapFactory.address,
      pairCodeHash,
      CONDUIT_CONTROLLER_ADDRESS[chainId],
    ],
  });

  console.log("Shoyu deployed at address", shoyu.address);
};

export default deployFunction;

deployFunction.dependencies = ["DeploySeaport", "DeploySushiswap"];

deployFunction.tags = ["DeployShoyu"];
