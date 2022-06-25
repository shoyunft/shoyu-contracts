import { Contract, Signer } from "ethers";
import { deployments, ethers } from "hardhat";
import { deployContract } from "../../../utils/contracts";

export const shoyuFixture = async (
  owner: Signer,
  seaport: Contract,
  conduitController: Contract
) => {
  await deployments.fixture("DeploySushiswap");

  const testWETH = await ethers.getContract("TestWETH");

  const sushiswapFactory = await ethers.getContract("UniswapV2Factory");

  const bentobox = await ethers.getContract("BentoBoxV1");

  const pairCodeHash = await sushiswapFactory.pairCodeHash();

  const transformationAdapter = await deployContract(
    "TransformationAdapter",
    owner as any,
    testWETH.address,
    sushiswapFactory.address,
    pairCodeHash,
    conduitController.address,
    bentobox.address
  );

  const adapterRegistry = await deployContract(
    "AdapterRegistry",
    owner as any,
    2,
    [transformationAdapter.address, seaport.address],
    [true, false]
  );

  const shoyuContract = await deployContract(
    "Shoyu",
    owner as any,
    adapterRegistry.address
  );

  return {
    shoyuContract,
    testWETH,
    transformationAdapter,
  };
};
