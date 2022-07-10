import {
  BENTOBOX_ADDRESS,
  FACTORY_ADDRESS,
  INIT_CODE_HASH,
  WNATIVE_ADDRESS,
} from "@sushiswap/core-sdk";
import { upgrades } from "hardhat";
import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { MaxUint256 } from "@ethersproject/constants";
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

  const { deploy, save } = deployments;

  const { deployer } = await getNamedAccounts();

  const chainId = Number(await getChainId());

  let wethAddress, pairCodeHash, sushiswapFactory, seaport, bentobox;

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

  if (chainId === 31337) {
    bentobox = await ethers.getContract("BentoBoxV1");
  } else if (chainId in BENTOBOX_ADDRESS) {
    bentobox = await ethers.getContractAt(
      "BentoBoxV1",
      BENTOBOX_ADDRESS[chainId]
    );
  } else {
    throw Error("No BENTOBOX!");
  }

  if (chainId in SEAPORT_ADDRESS) {
    seaport = await ethers.getContractAt("Seaport", SEAPORT_ADDRESS[chainId]);
  } else {
    seaport = await deployments.get("Seaport");
  }

  const transformationAdapter = await deploy("TransformationAdapter", {
    from: deployer,
    args: [
      wethAddress,
      sushiswapFactory.address,
      pairCodeHash,
      CONDUIT_CONTROLLER_ADDRESS[chainId],
      bentobox.address,
    ],
    log: true,
  });

  const seaportAdapter = await deploy("SeaportAdapter", {
    from: deployer,
    args: [seaport.address],
  });

  const adapterRegistry = await deploy("AdapterRegistry", {
    from: deployer,
    args: [2, [transformationAdapter.address, seaportAdapter.address]],
    log: true,
  });

  try {
    const shoyu = await ethers.getContract("Shoyu");

    const adapterRegistryAddress = await shoyu.adapterRegistry();

    if (adapterRegistryAddress !== adapterRegistry.address) throw new Error();

    console.log('reusing "Shoyu" at', shoyu.address);
  } catch (e) {
    const shoyuFactory = await ethers.getContractFactory("Shoyu");

    const shoyu = await upgrades.deployProxy(
      shoyuFactory,
      [adapterRegistry.address, bentobox.address],
      {
        initializer: "initialize",
        unsafeAllow: ["delegatecall"],
      }
    );

    await shoyu.deployed();

    const artifact = await deployments.getExtendedArtifact("Shoyu");
    await save("Shoyu", { address: shoyu.address, ...artifact });

    const shoyuContract = await ethers.getContract("Shoyu");

    await shoyuContract.approveERC20(wethAddress, seaport.address, MaxUint256);

    await shoyuContract.approveERC20(wethAddress, bentobox.address, MaxUint256);

    console.log("Shoyu deployed at address", shoyu.address);
  }
};

export default deployFunction;

deployFunction.dependencies = ["DeploySushiswap"];

deployFunction.tags = ["DeployShoyu"];
