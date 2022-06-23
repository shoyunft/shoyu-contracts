import { Contract, Signer, Wallet } from "ethers";
import { deployments, ethers } from "hardhat";
import { deployContract } from "../../utils/contracts";

export const shoyuFixture = async (
  owner: Signer,
  seaport: Contract,
  conduitController: Contract
) => {
  await deployments.fixture("DeploySushiswap");

  const testWETH = await ethers.getContract("TestWETH");

  const sushiswapFactory = await ethers.getContract("UniswapV2Factory");

  const pairCodeHash = await sushiswapFactory.pairCodeHash();

  const shoyuContract = await deployContract(
    "Shoyu",
    owner as any,
    seaport.address,
    testWETH.address,
    sushiswapFactory.address,
    pairCodeHash,
    conduitController.address
  );

  return { shoyuContract, testWETH };
};
