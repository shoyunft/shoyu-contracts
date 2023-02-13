import { BigNumber, Contract, Wallet } from "ethers";
import { ethers, network } from "hardhat";
import { MaxUint256 } from "@ethersproject/constants";
import { expect } from "chai";
import { Interface, parseEther } from "ethers/lib/utils";

import IUNISWAPV2_ABI from "@sushiswap/core/build/abi/IUniswapV2Pair.json";
import IPOOL from "@sushiswap/trident/artifacts/contracts/interfaces/IPool.sol/IPool.json";

import { seedSushiswapPools } from "./utils/fixtures/sushi";
import { faucet } from "./utils/impersonate";
import { seaportFixture } from "./utils/fixtures";
import { getItemETH, randomHex, toKey } from "./utils/encoding";
import { shoyuFixture } from "./utils/fixtures/shoyu";
import { TokenSource } from "./utils/contsants";
import { encodeFulfillAdvancedOrderParams } from "./utils/helpers";
import { encodedSwapData } from "./utils/trident";

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
  let getTestItem721: any;
  let getTestItem1155: any;
  let createOrder: any;
  let checkExpectedEvents: any;
  let seller: Wallet;
  let buyer: Wallet;
  let adapterRegistry: Contract;
  let conduitOne: Contract;
  let conduitKeyOne: any;

  const tridentPoolInterface = new Interface(IPOOL.abi);
  const legacyPoolInterface = new Interface(IUNISWAPV2_ABI);

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
      testERC1155,
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

  describe("[SHOYU]", async () => {
    it("Contract owner can pause and unpause `cook`", async () => {
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
      // and unwraps WETH for ETH before filling the order
      await testWETH.connect(buyer).deposit({ value });
      await testWETH.connect(buyer).approve(shoyuContract.address, MaxUint256);

      await expect(shoyuContract.connect(buyer).pause()).to.be.reverted;

      await shoyuContract.pause();

      await expect(
        shoyuContract.connect(buyer).cook(
          [0, 0, 1],
          [
            transformationAdapter.interface.encodeFunctionData(
              "transferERC20From",
              [
                testWETH.address, // token
                shoyuContract.address, // to
                value, // amount
                TokenSource.WALLET, // tokenSource
                "0x", // transferData
              ]
            ),
            transformationAdapter.interface.encodeFunctionData(
              "unwrapNativeToken",
              [
                value, // amount
                shoyuContract.address, // to
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
        )
      ).to.be.reverted;

      await shoyuContract.unpause();

      await withBalanceChecks([order], 0, null, async () => {
        const tx = shoyuContract.connect(buyer).cook(
          [0, 0, 1],
          [
            transformationAdapter.interface.encodeFunctionData(
              "transferERC20From",
              [
                testWETH.address, // token
                shoyuContract.address, // to
                value, // amount
                TokenSource.WALLET, // tokenSource
                "0x", // transferData
              ]
            ),
            transformationAdapter.interface.encodeFunctionData(
              "unwrapNativeToken",
              [
                value, // amount
                shoyuContract.address, // to
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
  });

  describe("Tests `cook()` function", async () => {
    describe("[REVERTS]", async () => {
      it("Reverts if an inactive adapter is called", async () => {
        await expect(
          shoyuContract.cook(
            ["0", "0"],
            [
              transformationAdapter.interface.encodeFunctionData(
                "wrapNativeToken",
                [
                  100, // amount
                ]
              ),
              transformationAdapter.interface.encodeFunctionData(
                "returnERC20",
                [
                  testWETH.address, // token
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
            ["0", "0"],
            [
              transformationAdapter.interface.encodeFunctionData(
                "wrapNativeToken",
                [
                  100, // amount
                ]
              ),
              transformationAdapter.interface.encodeFunctionData(
                "returnERC20",
                [
                  testWETH.address, // token
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
      let testWETHERC20Pool: Contract;
      beforeEach(async () => {
        [testWETHERC20Pool] = await seedSushiswapPools({
          pairs: [
            {
              token0: testWETH,
              token0Amount: parseEther("50"),
              token1: testERC20,
              token1Amount: parseEther("25"),
              type: "cp",
            },
            {
              token0: testWETH,
              token0Amount: parseEther("50"),
              token1: testERC20,
              token1Amount: parseEther("25"),
              type: "legacy",
            },
          ],
        });

        await Promise.all(
          [seller, buyer].map((wallet) => faucet(wallet.address, provider))
        );
      });

      it("User buys ERC721 listed in ETH by swapping ERC20 -> ETH w/ conduit & legacy swap", async () => {
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
            [0, 0, 1],
            [
              transformationAdapter.interface.encodeFunctionData(
                "legacySwapExactOut",
                [
                  value, // amountOut
                  MaxUint256, // amountInMax
                  [testERC20.address, testWETH.address], // path
                  shoyuContract.address, // to
                  TokenSource.CONDUIT, // tokenSource
                  conduitKeyOne, // transferData
                ]
              ),
              transformationAdapter.interface.encodeFunctionData(
                "unwrapNativeToken",
                [
                  value, // amount
                  shoyuContract.address, // to
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

      it("User buys ERC721 listed in ETH by swapping ERC20 -> ETH w/ conduit & trident swap", async () => {
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
            [0, 0, 1],
            [
              transformationAdapter.interface.encodeFunctionData(
                "tridentSwapExactOut",
                [
                  {
                    tokenOut: testWETH.address,
                    amountOut: value,
                    amountInMaximum: MaxUint256,
                    path: [
                      {
                        pool: testWETHERC20Pool.address,
                        data: encodedSwapData(
                          testERC20.address,
                          shoyuContract.address,
                          true
                        ),
                      },
                    ],
                  },
                  TokenSource.CONDUIT, // tokenSource
                  conduitKeyOne, // transferData
                ]
              ),
              transformationAdapter.interface.encodeFunctionData(
                "unwrapNativeToken",
                [
                  value, // amount
                  shoyuContract.address, // to
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

      it("User accepts offer on ERC721 and swaps ERC20 -> ETH w/ conduit & legacy swap", async () => {
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

        // seller swaps ERC20 for ETH and fills the order
        const sellerETHBalanceBefore = await provider.getBalance(
          seller.address
        );

        await withBalanceChecks([order], 0, null, async () => {
          const tx = shoyuContract.connect(seller).cook(
            [0, 1, 0, 0],
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
                "legacySwapExactIn",
                [
                  0, // amountIn
                  BigNumber.from(0), // amountOutMin
                  [testERC20.address, testWETH.address], // path
                  seller.address, // to
                ]
              ),
              transformationAdapter.interface.encodeFunctionData(
                "unwrapNativeToken",
                [
                  0, // amount
                  seller.address, // to
                ]
              ),
            ]
          );

          const receipt = await (await tx).wait();

          const swapEvent = receipt.events
            .map((event: any) => {
              try {
                return legacyPoolInterface.decodeEventLog(
                  "Swap",
                  event.data,
                  event.topics
                );
              } catch (e) {
                return null;
              }
            })
            .filter((event: any) => !!event)[0];

          const sellerETHBalanceAfter = await provider.getBalance(
            seller.address
          );

          expect(
            sellerETHBalanceAfter.sub(sellerETHBalanceBefore).abs().toString()
          ).to.eq(
            receipt.effectiveGasPrice
              .mul(receipt.gasUsed)
              .sub(swapEvent.amount1Out)
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

      it("User accepts offer on ERC721 and swaps ERC20 -> ETH w/ conduit & trident swap", async () => {
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
            [0, 1, 0, 0],
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
                "tridentSwapExactIn",
                [
                  {
                    tokenIn: testERC20.address,
                    amountIn: 0,
                    amountOutMinimum: BigNumber.from(0),
                    path: [
                      {
                        pool: testWETHERC20Pool.address,
                        data: encodedSwapData(
                          testERC20.address,
                          shoyuContract.address,
                          true
                        ),
                      },
                    ],
                  },
                ]
              ),
              transformationAdapter.interface.encodeFunctionData(
                "unwrapNativeToken",
                [
                  0, // amount
                  seller.address, // to
                ]
              ),
            ]
          );

          const receipt = await (await tx).wait();

          const swapEvent = receipt.events
            .map((event: any) => {
              try {
                return tridentPoolInterface.decodeEventLog(
                  "Swap",
                  event.data,
                  event.topics
                );
              } catch (e) {
                return null;
              }
            })
            .filter((event: any) => !!event)[0];

          const sellerETHBalanceAfter = await provider.getBalance(
            seller.address
          );

          expect(
            sellerETHBalanceAfter.sub(sellerETHBalanceBefore).abs().toString()
          ).to.eq(
            receipt.effectiveGasPrice
              .mul(receipt.gasUsed)
              .sub(swapEvent.amountOut)
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

      it("User accepts offer on ERC1155 and swaps ERC20 -> ETH w/ conduit & legacy swap", async () => {
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
            [0, 1, 0, 0],
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
                "legacySwapExactIn",
                [
                  0, // amountIn
                  BigNumber.from(0), // amountOutMin
                  [testERC20.address, testWETH.address], // path
                  seller.address, // to
                ]
              ),
              transformationAdapter.interface.encodeFunctionData(
                "unwrapNativeToken",
                [
                  0, // amount
                  seller.address, // to
                ]
              ),
            ]
          );

          const receipt = await (await tx).wait();

          const swapEvent = receipt.events
            .map((event: any) => {
              try {
                return legacyPoolInterface.decodeEventLog(
                  "Swap",
                  event.data,
                  event.topics
                );
              } catch (e) {
                return null;
              }
            })
            .filter((event: any) => !!event)[0];

          const sellerETHBalanceAfter = await provider.getBalance(
            seller.address
          );

          expect(
            sellerETHBalanceAfter.sub(sellerETHBalanceBefore).abs().toString()
          ).to.eq(
            receipt.effectiveGasPrice
              .mul(receipt.gasUsed)
              .sub(swapEvent.amount1Out)
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

      it("User accepts offer on ERC1155 and swaps ERC20 -> ETH w/ conduit & trident swap", async () => {
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
            [0, 1, 0, 0],
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
                "tridentSwapExactIn",
                [
                  {
                    tokenIn: testERC20.address,
                    amountIn: 0,
                    amountOutMinimum: BigNumber.from(0),
                    path: [
                      {
                        pool: testWETHERC20Pool.address,
                        data: encodedSwapData(
                          testERC20.address,
                          shoyuContract.address,
                          true
                        ),
                      },
                    ],
                  },
                ]
              ),
              transformationAdapter.interface.encodeFunctionData(
                "unwrapNativeToken",
                [
                  0, // amount
                  seller.address, // to
                ]
              ),
            ]
          );

          const receipt = await (await tx).wait();

          const swapEvent = receipt.events
            .map((event: any) => {
              try {
                return tridentPoolInterface.decodeEventLog(
                  "Swap",
                  event.data,
                  event.topics
                );
              } catch (e) {
                return null;
              }
            })
            .filter((event: any) => !!event)[0];

          const sellerETHBalanceAfter = await provider.getBalance(
            seller.address
          );

          expect(
            sellerETHBalanceAfter.sub(sellerETHBalanceBefore).abs().toString()
          ).to.eq(
            receipt.effectiveGasPrice
              .mul(receipt.gasUsed)
              .sub(swapEvent.amountOut)
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
