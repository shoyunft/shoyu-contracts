import { ethers, deployments } from "hardhat";
import { BigNumberish, Contract, Signer } from "ethers";
import { ContractTransaction } from "@ethersproject/contracts";
import { HardhatRuntimeEnvironment } from "hardhat/types";

async function transfer(
  signer: Signer & { address: string },
  token: Contract,
  amount: BigNumberish
) {
  const WETH = await ethers.getContract("TestWETH");
  if (token.address === WETH.address) {
    await token.connect(signer).deposit({ value: amount });
  } else {
    await token.mint(signer.address, amount);
  }
}

interface Pair {
  token0: Contract;
  token0Amount: BigNumberish;
  token1: Contract;
  token1Amount: BigNumberish;
  type: "legacy" | "cp" | "stable";
}

export const seedSushiswapPools = deployments.createFixture(
  async (
    {
      deployments,
      ethers: {
        getNamedSigners,
        constants: { MaxUint256 },
      },
    }: HardhatRuntimeEnvironment,
    options: { pairs: Pair[] } | undefined
  ) => {
    if (!options) return [];

    const { pairs } = options;

    await deployments.fixture(["ConstantProductPoolFactory"], {
      keepExistingDeployments: true, // ensure you start from a fresh deployments
    });

    const { deployer } = await getNamedSigners();

    const sushiswapRouter = await ethers.getContract("UniswapV2Router02");

    const masterDeployer = await ethers.getContract("MasterDeployer");

    const constantProductPoolFactory = await ethers.getContract(
      "ConstantProductPoolFactory"
    );

    const bento = await ethers.getContract("BentoBoxV1");

    await bento.whitelistMasterContract(
      "0x0000000000000000000000000000000000000001",
      true
    );

    const pools = [];

    for (let i = 0; i < pairs.length; i++) {
      await transfer(deployer, pairs[i].token0, pairs[i].token0Amount);
      await transfer(deployer, pairs[i].token1, pairs[i].token1Amount);

      if (pairs[i].type === "legacy") {
        await pairs[i].token0
          .connect(deployer)
          .approve(sushiswapRouter.address, MaxUint256);
        await pairs[i].token1
          .connect(deployer)
          .approve(sushiswapRouter.address, MaxUint256);

        await sushiswapRouter
          .connect(deployer)
          .addLiquidity(
            pairs[i].token0.address,
            pairs[i].token1.address,
            pairs[i].token0Amount,
            pairs[i].token1Amount,
            0,
            0,
            deployer.address,
            MaxUint256
          );
      } else if (pairs[i].type === "cp") {
        const deployData = ethers.utils.defaultAbiCoder.encode(
          ["address", "address", "uint256", "bool"],
          [pairs[i].token0.address, pairs[i].token1.address, 0, false]
        );

        const contractReceipt = await masterDeployer
          .deployPool(constantProductPoolFactory.address, deployData)
          .then((tx: any) => tx.wait());

        await pairs[i].token0
          .connect(deployer)
          .approve(bento.address, MaxUint256);
        await pairs[i].token1
          .connect(deployer)
          .approve(bento.address, MaxUint256);

        await bento
          .setMasterContractApproval(
            deployer.address,
            "0x0000000000000000000000000000000000000001",
            true,
            "0",
            "0x0000000000000000000000000000000000000000000000000000000000000000",
            "0x0000000000000000000000000000000000000000000000000000000000000000"
          )
          .then((tx: ContractTransaction) => tx.wait());

        await bento
          .deposit(
            pairs[i].token0.address,
            deployer.address,
            deployer.address,
            pairs[i].token0Amount,
            0
          )
          .then((tx: ContractTransaction) => tx.wait());

        await bento
          .deposit(
            pairs[i].token1.address,
            deployer.address,
            deployer.address,
            pairs[i].token1Amount,
            0
          )
          .then((tx: ContractTransaction) => tx.wait());

        await bento
          .transfer(
            pairs[i].token0.address,
            deployer.address,
            contractReceipt.events?.[0].args?.pool,
            pairs[i].token0Amount
          )
          .then((tx: ContractTransaction) => tx.wait());

        await bento

          .transfer(
            pairs[i].token1.address,
            deployer.address,
            contractReceipt.events?.[0].args?.pool,
            pairs[i].token1Amount
          )
          .then((tx: ContractTransaction) => tx.wait());

        const Pool = await ethers.getContractFactory("ConstantProductPool");

        const pool = Pool.attach(contractReceipt.events?.[0].args?.pool);

        await pool
          .mint(
            ethers.utils.defaultAbiCoder.encode(["address"], [deployer.address])
          )
          .then((tx: ContractTransaction) => tx.wait());

        pools.push(pool);
      }
    }

    return pools;
  }
);
