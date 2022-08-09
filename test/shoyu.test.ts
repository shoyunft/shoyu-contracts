import { BigNumber, Contract, Wallet } from "ethers";
import { ethers, network } from "hardhat";
import { MaxUint256 } from "@ethersproject/constants";
import { expect } from "chai";
import { Interface, parseEther } from "ethers/lib/utils";

import IUNISWAPV2_ABI from "@sushiswap/core/build/abi/IUniswapV2Pair.json";

import { seedSushiswapPools } from "./utils/fixtures/sushi";
import { faucet } from "./utils/impersonate";
import { seaportFixture } from "./utils/fixtures";
import { getItemETH, randomHex, toKey } from "./utils/encoding";
import { shoyuFixture } from "./utils/fixtures/shoyu";
import { TokenSource } from "./utils/contsants";
import { encodeFulfillAdvancedOrderParams } from "./utils/helpers";

describe("[SHOYU] Tests", function () {
  const provider = ethers.provider;
  let shoyuContract: Contract;
  let transformationAdapter: Contract;
  let seaportAdapter: Contract;
  let zone: Wallet;
  let marketplaceContract: Contract;
  let testERC20: Contract;
  let testERC721: Contract;
  let testERC1155: Contract;
  let testWETH: Contract;
  let owner: Wallet;
  let withBalanceChecks: any;
  let conduitController: any;
  let mintAndApproveERC20: any;
  let mintAndApprove721: any;
  let mintAndApprove1155: any;
  let getTestItem20: any;
  let mint721: any;
  let getTestItem721: any;
  let mint1155: any;
  let getTestItem1155: any;
  let createOrder: any;
  let checkExpectedEvents: any;
  let seller: Wallet;
  let buyer: Wallet;
  let adapterRegistry: Contract;
  let conduitOne: Contract;
  let conduitKeyOne: any;

  after(async () => {
    await network.provider.request({
      method: "hardhat_reset",
    });
  });

  before(async () => {
    owner = new ethers.Wallet(randomHex(32), provider);
    seller = new ethers.Wallet(randomHex(32), provider);
    buyer = new ethers.Wallet(randomHex(32), provider);
    zone = new ethers.Wallet(randomHex(32), provider);

    await Promise.all(
      [owner, seller, buyer, zone].map((wallet) =>
        faucet(wallet.address, provider)
      )
    );

    ({
      conduitOne,
      conduitKeyOne,
      conduitController,
      testERC20,
      mintAndApproveERC20,
      mintAndApprove721,
      mintAndApprove1155,
      getTestItem20,
      getTestItem721,
      getTestItem1155,
      testERC721,
      mint721,
      testERC1155,
      mint1155,
      getTestItem1155,
      marketplaceContract,
      createOrder,
      withBalanceChecks,
      checkExpectedEvents,
    } = await seaportFixture(owner));

    ({
      shoyuContract,
      testWETH,
      transformationAdapter,
      seaportAdapter,
      adapterRegistry,
    } = await shoyuFixture(
      owner,
      marketplaceContract,
      conduitController,
      testERC20
    ));

    await conduitController
      .connect(owner)
      .updateChannel(conduitOne.address, shoyuContract.address, true);
  });

  describe("Tests `cook()` function", async () => {
    describe("[REVERTS]", async () => {
      it("Reverts if an inactive adapter is called", async () => {
        await expect(
          shoyuContract.cook(
            ["0"],
            [
              transformationAdapter.interface.encodeFunctionData(
                "wrapNativeToken",
                [
                  100, // amount
                ]
              ),
            ],
            {
              value: 100,
            }
          )
        ).to.not.be.reverted;

        await adapterRegistry.setAdapterStatus(0, false);

        await expect(
          shoyuContract.cook(
            ["0"],
            [
              transformationAdapter.interface.encodeFunctionData(
                "wrapNativeToken",
                [
                  100, // amount
                ]
              ),
            ],
            {
              value: 100,
            }
          )
        ).to.be.reverted;

        await adapterRegistry.setAdapterStatus(0, true);
      });
    });

    describe("[SEAPORT + CONDUIT + TRANSFORM]", async () => {
      beforeEach(async () => {
        await seedSushiswapPools({
          pairs: [
            {
              token0: testWETH,
              token0Amount: parseEther("50"),
              token1: testERC20,
              token1Amount: parseEther("25"),
            },
          ],
        });

        await Promise.all(
          [seller, buyer].map((wallet) => faucet(wallet.address, provider))
        );
      });

      it("User buys ERC721 listed in ETH by swapping ERC20 -> ETH (with conduit)", async () => {
        // seller creates listing for 1ERC721 at price of 1ETH + .1ETH fee
        const nftId = await mintAndApprove721(
          seller,
          marketplaceContract.address
        );

        const offer = [getTestItem721(nftId)];

        const consideration = [
          getItemETH(parseEther("1"), parseEther("1"), seller.address),
          getItemETH(parseEther(".1"), parseEther(".1"), zone.address),
        ];

        const { order, orderHash, value } = await createOrder(
          seller,
          zone,
          offer,
          consideration,
          0 // FULL_OPEN
        );

        // buyer fills order through Shoyu contract
        // and swaps ERC20 for ETH before filling the order
        await mintAndApproveERC20(buyer, conduitOne.address, parseEther("5"));

        await withBalanceChecks([order], 0, null, async () => {
          const tx = shoyuContract.connect(buyer).cook(
            [0, 1],
            [
              transformationAdapter.interface.encodeFunctionData(
                "swapExactOut",
                [
                  value, // amountOut
                  MaxUint256, // amountInMax
                  [testERC20.address, testWETH.address], // path
                  shoyuContract.address, // to
                  TokenSource.CONDUIT, // tokenSource
                  conduitKeyOne, // transferData
                  true, // unwrapNativeToken
                ]
              ),
              seaportAdapter.interface.encodeFunctionData("fulfill", [
                value,
                encodeFulfillAdvancedOrderParams(
                  order,
                  [],
                  toKey(false),
                  buyer.address
                ),
              ]),
            ]
          );
          const receipt = await (await tx).wait();

          await checkExpectedEvents(tx, receipt, [
            {
              order,
              orderHash,
              fulfiller: buyer.address,
            },
          ]);
          return receipt;
        });
      });

      it("User accepts offer on ERC721 and swaps ERC20 -> ETH (with conduit)", async () => {
        const nftId = await mintAndApprove721(seller, conduitOne.address);

        await mintAndApproveERC20(
          buyer,
          marketplaceContract.address,
          parseEther("5")
        );

        // buyer creates offer for 1ERC721 at price of 1ERC20 + .1ERC20 fee
        const offer = [getTestItem20(parseEther("1.1"), parseEther("1.1"))];

        const consideration = [
          getTestItem721(nftId, 1, 1, buyer.address),
          getTestItem20(parseEther(".1"), parseEther(".1"), zone.address),
        ];

        const { order, orderHash } = await createOrder(
          buyer,
          zone,
          offer,
          consideration,
          0 // FULL_OPEN
        );

        // buyer fills order through Shoyu contract
        // and swaps ERC20 for ETH before filling the order
        const sellerETHBalanceBefore = await provider.getBalance(
          seller.address
        );

        await withBalanceChecks([order], 0, null, async () => {
          const tx = shoyuContract.connect(seller).cook(
            [0, 1, 0],
            [
              transformationAdapter.interface.encodeFunctionData(
                "transferERC721From",
                [
                  testERC721.address,
                  shoyuContract.address,
                  nftId,
                  TokenSource.CONDUIT,
                  conduitKeyOne,
                ]
              ),
              seaportAdapter.interface.encodeFunctionData(
                "approveBeforeFulfill",
                [
                  [testERC721.address],
                  0,
                  encodeFulfillAdvancedOrderParams(
                    order,
                    [],
                    toKey(false),
                    shoyuContract.address
                  ),
                ]
              ),
              transformationAdapter.interface.encodeFunctionData(
                "swapExactIn",
                [
                  parseEther("1"), // amountIn
                  BigNumber.from(0), // amountOutMin
                  [testERC20.address, testWETH.address], // path
                  seller.address, // to
                  true, // unwrapNativeToken
                ]
              ),
            ]
          );

          const receipt = await (await tx).wait();

          const lpInterface = new Interface(IUNISWAPV2_ABI);

          const swapEvent = receipt.events
            .filter((event: any) => {
              try {
                lpInterface.decodeEventLog("Swap", event.data, event.topics);
                return true;
              } catch (e) {
                return false;
              }
            })
            .map((event: any) =>
              lpInterface.decodeEventLog("Swap", event.data, event.topics)
            )[0];

          const sellerETHBalanceAfter = await provider.getBalance(
            seller.address
          );

          expect(
            sellerETHBalanceAfter.sub(sellerETHBalanceBefore).abs().toString()
          ).to.eq(
            receipt.effectiveGasPrice
              .mul(receipt.gasUsed)
              .sub(swapEvent.amount0Out)
              .abs()
              .toString()
          );

          await checkExpectedEvents(
            tx,
            receipt,
            [
              {
                order,
                orderHash,
                fulfiller: shoyuContract.address,
              },
            ],
            [
              {
                item: consideration[0],
                offerer: shoyuContract.address,
                conduitKey: toKey(false),
              },
            ]
          );

          return receipt;
        });
      });

      it("User accepts offer on ERC1155 and swaps ERC20 -> ETH (with conduit)", async () => {
        const { nftId, amount } = await mintAndApprove1155(
          seller,
          conduitOne.address
        );

        await mintAndApproveERC20(
          buyer,
          marketplaceContract.address,
          parseEther("5")
        );

        // buyer creates offer for 1ERC721 at price of 1ERC20 + .1ERC20 fee
        const offer = [getTestItem20(parseEther("1.1"), parseEther("1.1"))];

        const consideration = [
          getTestItem1155(nftId, amount, amount, undefined, buyer.address),
          getTestItem20(parseEther(".1"), parseEther(".1"), zone.address),
        ];

        const { order, orderHash } = await createOrder(
          buyer,
          zone,
          offer,
          consideration,
          0 // FULL_OPEN
        );

        // buyer fills order through Shoyu contract
        // and swaps ERC20 for ETH before filling the order
        const sellerETHBalanceBefore = await provider.getBalance(
          seller.address
        );

        await withBalanceChecks([order], 0, null, async () => {
          const tx = shoyuContract.connect(seller).cook(
            [0, 1, 0],
            [
              transformationAdapter.interface.encodeFunctionData(
                "transferERC1155From",
                [
                  testERC1155.address,
                  shoyuContract.address,
                  nftId,
                  amount,
                  TokenSource.CONDUIT,
                  conduitKeyOne,
                ]
              ),
              seaportAdapter.interface.encodeFunctionData(
                "approveBeforeFulfill",
                [
                  [testERC1155.address],
                  0,
                  encodeFulfillAdvancedOrderParams(
                    order,
                    [],
                    toKey(false),
                    shoyuContract.address
                  ),
                ]
              ),
              transformationAdapter.interface.encodeFunctionData(
                "swapExactIn",
                [
                  parseEther("1"), // amountIn
                  BigNumber.from(0), // amountOutMin
                  [testERC20.address, testWETH.address], // path
                  seller.address, // to
                  true, // unwrapNativeToken
                ]
              ),
            ]
          );

          const receipt = await (await tx).wait();

          const lpInterface = new Interface(IUNISWAPV2_ABI);

          const swapEvent = receipt.events
            .filter((event: any) => {
              try {
                lpInterface.decodeEventLog("Swap", event.data, event.topics);
                return true;
              } catch (e) {
                return false;
              }
            })
            .map((event: any) =>
              lpInterface.decodeEventLog("Swap", event.data, event.topics)
            )[0];

          const sellerETHBalanceAfter = await provider.getBalance(
            seller.address
          );

          expect(
            sellerETHBalanceAfter.sub(sellerETHBalanceBefore).abs().toString()
          ).to.eq(
            receipt.effectiveGasPrice
              .mul(receipt.gasUsed)
              .sub(swapEvent.amount0Out)
              .abs()
              .toString()
          );

          await checkExpectedEvents(
            tx,
            receipt,
            [
              {
                order,
                orderHash,
                fulfiller: shoyuContract.address,
              },
            ],
            [
              {
                item: { ...consideration[0], amount },
                offerer: shoyuContract.address,
                conduitKey: toKey(false),
                operator: marketplaceContract.address,
              },
            ]
          );

          return receipt;
        });
      });
    });
  });
});
