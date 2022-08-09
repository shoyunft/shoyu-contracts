import { Contract, Signer } from "ethers";
import { MaxUint256 } from "@ethersproject/constants";
import { deployments, ethers } from "hardhat";
import { deployContract } from "../contracts";

export const shoyuFixture = async (
  owner: Signer,
  seaport: Contract,
  conduitController: Contract,
  testERC20: Contract
) => {
  await deployments.fixture("DeploySushiswap");

  const testWETH = await ethers.getContract("TestWETH");

  const sushiswapFactory = await ethers.getContract("UniswapV2Factory");

  const sushiswapRouter = await ethers.getContract("UniswapV2Router02");

  const pairCodeHash = await sushiswapFactory.pairCodeHash();

  const transformationAdapter = await deployContract(
    "TransformationAdapter",
    owner as any,
    testWETH.address,
    sushiswapFactory.address,
    pairCodeHash,
    conduitController.address
  );

  const seaportAdapter = await deployContract(
    "SeaportAdapter",
    owner as any,
    seaport.address
  );

  const adapterRegistry = await deployContract(
    "AdapterRegistry",
    owner as any,
    2,
    [transformationAdapter.address, seaportAdapter.address]
  );

  console.log("Adapter registry deployed at", adapterRegistry.address);

  const shoyuContract = await deployContract(
    "Shoyu",
    owner as any,
    adapterRegistry.address
  );

  console.log("Shoyu deployed at", shoyuContract.address);

  await shoyuContract.approveERC20(
    testWETH.address,
    seaport.address,
    MaxUint256
  );

  await shoyuContract.approveERC20(
    testERC20.address,
    seaport.address,
    MaxUint256
  );

  return {
    shoyuContract,
    testWETH,
    transformationAdapter,
    seaportAdapter,
    adapterRegistry,
    sushiswapRouter,
    sushiswapFactory,
  };
};
