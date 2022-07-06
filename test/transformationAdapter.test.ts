import { BigNumber, Contract, Wallet } from "ethers";
import { ethers, network } from "hardhat";
import { MaxUint256 } from "@ethersproject/constants";
import { expect } from "chai";
import { Interface, parseEther } from "ethers/lib/utils";

import IUNISWAPV2_ABI from "@sushiswap/core/build/abi/IUniswapV2Pair.json";

import { seedSushiswapPools } from "./utils/fixtures/sushi";
import { faucet } from "./utils/impersonate";
import { seaportFixture } from "./utils/fixtures";
import {
  getItemETH,
  randomHex,
  toFulfillmentComponents,
  toKey,
} from "./utils/encoding";
import { shoyuFixture } from "./utils/fixtures/shoyu";
import { TokenSource } from "./utils/contsants";

describe("[TRANFORMATION] Tests", function () {
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
  let getTestItem20: any;
  let mintAndApprove721: any;
  let getTestItem721: any;
  let mintAndApprove1155: any;
  let getTestItem1155: any;
  let createOrder: any;
  let checkExpectedEvents: any;
  let seller: Wallet;
  let buyer: Wallet;

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
      conduitController,
      testERC20,
      mintAndApproveERC20,
      getTestItem20,
      testERC721,
      mintAndApprove721,
      getTestItem721,
      testERC1155,
      mintAndApprove1155,
      getTestItem1155,
      marketplaceContract,
      createOrder,
      withBalanceChecks,
      checkExpectedEvents,
    } = await seaportFixture(owner));

    ({ shoyuContract, testWETH, transformationAdapter, seaportAdapter } =
      await shoyuFixture(
        owner,
        marketplaceContract,
        conduitController,
        testERC20
      ));
  });

  describe("Tests various transformations before filling seaport orders", async () => {
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

    it("User buys ERC721 listed in ETH by swapping ERC20 -> ETH", async () => {
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
      await mintAndApproveERC20(buyer, shoyuContract.address, parseEther("5"));

      await withBalanceChecks([order], 0, null, async () => {
        const tx = shoyuContract.connect(buyer).cook(
          [0, 1],
          [
            transformationAdapter.interface.encodeFunctionData("swapExactOut", [
              value, // amountOut
              MaxUint256, // amountInMax
              [testERC20.address, testWETH.address], // path
              shoyuContract.address, // to
              TokenSource.WALLET, // tokenSource
              "0x", // transferData
              true, // unwrapNativeToken
            ]),
            seaportAdapter.interface.encodeFunctionData("fulfill", [
              value,
              marketplaceContract.interface.encodeFunctionData(
                "fulfillAdvancedOrder",
                [order, [], toKey(false), buyer.address]
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

    it("User buys ERC721 listed in ETH by unwrapping WETH -> ETH", async () => {
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
              marketplaceContract.interface.encodeFunctionData(
                "fulfillAdvancedOrder",
                [order, [], toKey(false), buyer.address]
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

    it("User buys ERC721 listed in WETH by wrapping ETH -> WETH", async () => {
      // seller creates listing for 1ERC721 at price of 1WETH + .1WETH fee
      const nftId = await mintAndApprove721(
        seller,
        marketplaceContract.address
      );

      const offer = [getTestItem721(nftId)];

      const consideration = [
        getTestItem20(
          parseEther("1"),
          parseEther("1"),
          seller.address,
          testWETH.address
        ),
        getTestItem20(
          parseEther(".1"),
          parseEther(".1"),
          zone.address,
          testWETH.address
        ),
      ];

      const { order, orderHash } = await createOrder(
        seller,
        zone,
        offer,
        consideration,
        0 // FULL_OPEN
      );

      const value = parseEther("1.1");

      await withBalanceChecks([order], 0, null, async () => {
        const tx = shoyuContract.connect(buyer).cook(
          [0, 1],
          [
            transformationAdapter.interface.encodeFunctionData(
              "wrapNativeToken",
              [
                value, // amount
              ]
            ),
            seaportAdapter.interface.encodeFunctionData("fulfill", [
              toKey(false),
              marketplaceContract.interface.encodeFunctionData(
                "fulfillAdvancedOrder",
                [order, [], toKey(false), buyer.address]
              ),
            ]),
          ],
          {
            value,
          }
        );
        const receipt = await (await tx).wait();

        await checkExpectedEvents(
          tx,
          receipt,
          [
            {
              order,
              orderHash,
              fulfiller: buyer.address,
            },
          ],
          [
            {
              item: { ...consideration[0], amount: parseEther("1") },
              offerer: shoyuContract.address,
              conduitKey: toKey(false),
            },
          ]
        );

        return receipt;
      });
    });

    it("User buys single listed bundle of ERC721+ERC1155 by swapping ERC20 -> ETH", async () => {
      // seller creates listing for 1ERC721 + 1ERC1155 at price of 1ETH + .1ETH fee
      const erc721Id = await mintAndApprove721(
        seller,
        marketplaceContract.address
      );

      const { nftId: erc1155Id, amount: erc1155Amount } =
        await mintAndApprove1155(seller, marketplaceContract.address, 1);

      const offer = [
        getTestItem721(erc721Id),
        getTestItem1155(erc1155Id, erc1155Amount, erc1155Amount),
      ];

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
      await mintAndApproveERC20(buyer, shoyuContract.address, parseEther("5"));

      await withBalanceChecks([order], 0, null, async () => {
        const tx = shoyuContract.connect(buyer).cook(
          [0, 1],
          [
            transformationAdapter.interface.encodeFunctionData("swapExactOut", [
              value, // amountOut
              MaxUint256, // amountInMax
              [testERC20.address, testWETH.address], // path
              shoyuContract.address, // to
              TokenSource.WALLET, // tokenSource
              "0x", // transferData
              true, // unwrapNativeToken
            ]),
            seaportAdapter.interface.encodeFunctionData("fulfill", [
              value,
              marketplaceContract.interface.encodeFunctionData(
                "fulfillAdvancedOrder",
                [order, [], toKey(false), buyer.address]
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

    it("User buys listed ERC721 with ETH and swapping ERC20 -> ETH", async () => {
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
      await mintAndApproveERC20(buyer, shoyuContract.address, parseEther("5"));

      await withBalanceChecks([order], 0, null, async () => {
        const tx = shoyuContract.connect(buyer).cook(
          [0, 1],
          [
            transformationAdapter.interface.encodeFunctionData("swapExactOut", [
              value.div(2), // amountOut
              MaxUint256, // amountInMax
              [testERC20.address, testWETH.address], // path
              shoyuContract.address, // to
              TokenSource.WALLET, // tokenSource
              "0x", // transferData
              true, // unwrapNativeToken
            ]),
            seaportAdapter.interface.encodeFunctionData("fulfill", [
              value,
              marketplaceContract.interface.encodeFunctionData(
                "fulfillAdvancedOrder",
                [order, [], toKey(false), buyer.address]
              ),
            ]),
          ],
          {
            value: value.div(2),
          }
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

    it("User batch buys ERC721+ERC1155 in seperate listings by swapping ERC20 -> ETH", async () => {
      // seller creates listing for 1ERC721 + 1ERC1155 at price of 1ETH + .1ETH fee
      const erc721Id = await mintAndApprove721(
        seller,
        marketplaceContract.address
      );

      const { nftId: erc1155Id, amount: erc1155Amount } =
        await mintAndApprove1155(seller, marketplaceContract.address, 1);

      // order0: 1 ERC721 for 1ETH+.1ETH Fee
      const offer0 = [getTestItem721(erc721Id)];

      const consideration0 = [
        getItemETH(parseEther("1"), parseEther("1"), seller.address),
        getItemETH(parseEther(".1"), parseEther(".1"), zone.address),
      ];

      const {
        order: order0,
        orderHash: orderHash0,
        value: value0,
      } = await createOrder(
        seller,
        zone,
        offer0,
        consideration0,
        0 // FULL_OPEN
      );

      // order1: 1 ERC1155 for 1ETH+.1ETH Fee
      const offer1 = [getTestItem1155(erc1155Id, erc1155Amount, erc1155Amount)];

      const consideration1 = [
        getItemETH(parseEther("1"), parseEther("1"), seller.address),
        getItemETH(parseEther(".1"), parseEther(".1"), zone.address),
      ];

      const {
        order: order1,
        orderHash: orderHash1,
        value: value1,
      } = await createOrder(
        seller,
        zone,
        offer1,
        consideration1,
        0 // FULL_OPEN
      );

      // buyer fills order through Shoyu contract
      // and swaps ERC20 for ETH before filling the order
      await mintAndApproveERC20(buyer, shoyuContract.address, parseEther("5"));

      const offerComponents = [[[0, 0]], [[1, 0]]].map(toFulfillmentComponents);

      const considerationComponents = [
        [
          [0, 0],
          [1, 0],
        ],
        [
          [0, 1],
          [1, 1],
        ],
      ].map(toFulfillmentComponents);

      const totalValue = value0.add(value1);

      await withBalanceChecks([order0, order1], 0, null, async () => {
        const tx = shoyuContract.connect(buyer).cook(
          [0, 1],
          [
            transformationAdapter.interface.encodeFunctionData("swapExactOut", [
              totalValue, // amountOut
              MaxUint256, // amountInMax
              [testERC20.address, testWETH.address], // path
              shoyuContract.address, // to
              TokenSource.WALLET, // tokenSource
              "0x", // transferData
              true, // unwrapNativeToken
            ]),
            seaportAdapter.interface.encodeFunctionData("fulfill", [
              totalValue,
              marketplaceContract.interface.encodeFunctionData(
                "fulfillAvailableAdvancedOrders",
                [
                  [order0, order1],
                  [],
                  offerComponents,
                  considerationComponents,
                  toKey(false),
                  buyer.address,
                  2,
                ]
              ),
            ]),
          ]
        );

        const receipt = await (await tx).wait();

        await checkExpectedEvents(tx, receipt, [
          {
            order: order0,
            orderHash: orderHash0,
            fulfiller: buyer.address,
            receipt: buyer.address,
          },
          {
            order: order1,
            orderHash: orderHash1,
            fulfiller: buyer.address,
            receipt: buyer.address,
          },
        ]);
        return receipt;
      });
    });

    it("User batch buys ERC721+ERC1155 in seperate listings with ETH and swapping ERC20 -> ETH", async () => {
      // seller creates listing for 1ERC721 + 1ERC1155 at price of 1ETH + .1ETH fee
      const erc721Id = await mintAndApprove721(
        seller,
        marketplaceContract.address
      );

      const { nftId: erc1155Id, amount: erc1155Amount } =
        await mintAndApprove1155(seller, marketplaceContract.address, 1);

      // order0: 1 ERC721 for 1ETH+.1ETH Fee
      const offer0 = [getTestItem721(erc721Id)];

      const consideration0 = [
        getItemETH(parseEther("1"), parseEther("1"), seller.address),
        getItemETH(parseEther(".1"), parseEther(".1"), zone.address),
      ];

      const {
        order: order0,
        orderHash: orderHash0,
        value: value0,
      } = await createOrder(
        seller,
        zone,
        offer0,
        consideration0,
        0 // FULL_OPEN
      );

      // order1: 1 ERC1155 for 1ETH+.1ETH Fee
      const offer1 = [getTestItem1155(erc1155Id, erc1155Amount, erc1155Amount)];

      const consideration1 = [
        getItemETH(parseEther("1"), parseEther("1"), seller.address),
        getItemETH(parseEther(".1"), parseEther(".1"), zone.address),
      ];

      const {
        order: order1,
        orderHash: orderHash1,
        value: value1,
      } = await createOrder(
        seller,
        zone,
        offer1,
        consideration1,
        0 // FULL_OPEN
      );

      // buyer fills order through Shoyu contract
      // and swaps ERC20 for ETH before filling the order
      await mintAndApproveERC20(buyer, shoyuContract.address, parseEther("5"));

      const offerComponents = [[[0, 0]], [[1, 0]]].map(toFulfillmentComponents);

      const considerationComponents = [
        [
          [0, 0],
          [1, 0],
        ],
        [
          [0, 1],
          [1, 1],
        ],
      ].map(toFulfillmentComponents);

      const totalValue = value0.add(value1);

      await withBalanceChecks([order0, order1], 0, null, async () => {
        const tx = shoyuContract.connect(buyer).cook(
          [0, 1],
          [
            transformationAdapter.interface.encodeFunctionData("swapExactOut", [
              totalValue.div(2), // amountOut
              MaxUint256, // amountInMax
              [testERC20.address, testWETH.address], // path
              shoyuContract.address, // to
              TokenSource.WALLET, // tokenSource
              "0x", // transferData
              true, // unwrapNativeToken
            ]),
            seaportAdapter.interface.encodeFunctionData("fulfill", [
              totalValue,
              marketplaceContract.interface.encodeFunctionData(
                "fulfillAvailableAdvancedOrders",
                [
                  [order0, order1],
                  [],
                  offerComponents,
                  considerationComponents,
                  toKey(false),
                  buyer.address,
                  2,
                ]
              ),
            ]),
          ],
          {
            value: totalValue.div(2),
          }
        );

        const receipt = await (await tx).wait();

        await checkExpectedEvents(tx, receipt, [
          {
            order: order0,
            orderHash: orderHash0,
            fulfiller: buyer.address,
            receipt: buyer.address,
          },
          {
            order: order1,
            orderHash: orderHash1,
            fulfiller: buyer.address,
            receipt: buyer.address,
          },
        ]);
        return receipt;
      });
    });

    it("Excess ETH is refunded when buying listed ERC721 by swapping ERC20 -> ETH", async () => {
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
      await mintAndApproveERC20(buyer, shoyuContract.address, parseEther("5"));

      const buyerETHBalanceBefore = await provider.getBalance(buyer.address);

      await withBalanceChecks([order], 0, null, async () => {
        const tx = shoyuContract.connect(buyer).cook(
          [0, 1],
          [
            transformationAdapter.interface.encodeFunctionData("swapExactOut", [
              value.add(42069), // amountOut
              MaxUint256, // amountInMax
              [testERC20.address, testWETH.address], // path
              shoyuContract.address, // to
              TokenSource.WALLET, // tokenSource
              "0x", // transferData
              true, // unwrapNativeToken
            ]),
            seaportAdapter.interface.encodeFunctionData("fulfill", [
              value,
              marketplaceContract.interface.encodeFunctionData(
                "fulfillAdvancedOrder",
                [order, [], toKey(false), buyer.address]
              ),
            ]),
          ]
        );

        const receipt = await (await tx).wait();

        const buyerETHBalanceAfter = await provider.getBalance(buyer.address);

        expect(
          buyerETHBalanceAfter.sub(buyerETHBalanceBefore).abs().toString()
        ).to.eq(
          receipt.effectiveGasPrice.mul(receipt.gasUsed).sub(42069).toString()
        );

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

    it("Excess ETH is refunded if one or more orders cannot be filled when batch filling", async () => {
      // seller creates listing for 1ERC721 at price of 1ETH + .1ETH fee
      const { amount, nftId } = await mintAndApprove1155(
        seller,
        marketplaceContract.address
      );

      const offer = [getTestItem1155(nftId, amount.div(2), amount.div(2))];

      const consideration = [
        getItemETH(parseEther("1"), parseEther("1"), seller.address),
        getItemETH(parseEther(".1"), parseEther(".1"), zone.address),
      ];

      const order0 = await createOrder(
        seller,
        zone,
        offer,
        consideration,
        0 // FULL_OPEN
      );

      const order1 = await createOrder(
        seller,
        zone,
        offer,
        consideration,
        0, // FULL_OPEN
        [],
        "EXPIRED"
      );

      // buyer fills order through Shoyu contract
      // and swaps ERC20 for ETH before filling the order
      await mintAndApproveERC20(buyer, shoyuContract.address, parseEther("5"));

      const buyerETHBalanceBefore = await provider.getBalance(buyer.address);
      const offerComponents = [[[0, 0]], [[1, 0]]].map(toFulfillmentComponents);

      const considerationComponents = [
        [
          [0, 0],
          [1, 0],
        ],
        [
          [0, 1],
          [1, 1],
        ],
      ].map(toFulfillmentComponents);

      const totalValue = order0.value.add(order1.value);

      await withBalanceChecks([order0.order], 0, null, async () => {
        const tx = await shoyuContract.connect(buyer).cook(
          [0, 1],
          [
            transformationAdapter.interface.encodeFunctionData("swapExactOut", [
              totalValue, // amountOut
              MaxUint256, // amountInMax
              [testERC20.address, testWETH.address], // path
              shoyuContract.address, // to
              TokenSource.WALLET, // tokenSource
              "0x", // transferData
              true, // unwrapNativeToken
            ]),
            seaportAdapter.interface.encodeFunctionData("fulfill", [
              totalValue,
              marketplaceContract.interface.encodeFunctionData(
                "fulfillAvailableAdvancedOrders",
                [
                  [order0.order, order1.order],
                  [],
                  offerComponents,
                  considerationComponents,
                  toKey(false),
                  buyer.address,
                  2,
                ]
              ),
            ]),
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

        const buyerETHBalanceAfter = await provider.getBalance(buyer.address);

        expect(
          buyerETHBalanceAfter.sub(buyerETHBalanceBefore).abs().toString()
        ).to.eq(
          receipt.effectiveGasPrice
            .mul(receipt.gasUsed)
            .sub(swapEvent.amount0Out)
            .add(order1.value)
            .abs()
            .toString()
        );

        await checkExpectedEvents(tx, receipt, [
          {
            order: order0.order,
            orderHash: order0.orderHash,
            fulfiller: buyer.address,
          },
        ]);
        return receipt;
      });
    });

    it("User accepts offer on ERC721 and swaps ERC20 -> ETH", async () => {
      const nftId = await mintAndApprove721(seller, shoyuContract.address);

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
      const sellerETHBalanceBefore = await provider.getBalance(seller.address);

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
                TokenSource.WALLET,
                "0x",
              ]
            ),
            seaportAdapter.interface.encodeFunctionData(
              "approveBeforeFulfill",
              [
                [testERC721.address],
                0,
                marketplaceContract.interface.encodeFunctionData(
                  "fulfillAdvancedOrder",
                  [order, [], toKey(false), shoyuContract.address]
                ),
              ]
            ),
            transformationAdapter.interface.encodeFunctionData("swapExactIn", [
              parseEther("1"), // amountIn
              BigNumber.from(0), // amountOutMin
              [testERC20.address, testWETH.address], // path
              seller.address, // to
              true, // unwrapNativeToken
            ]),
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

        const sellerETHBalanceAfter = await provider.getBalance(seller.address);

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

    it("User accepts offer on ERC1155 and swaps ERC20 -> ETH", async () => {
      const { nftId, amount } = await mintAndApprove1155(
        seller,
        shoyuContract.address
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
      const sellerETHBalanceBefore = await provider.getBalance(seller.address);

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
                TokenSource.WALLET,
                "0x",
              ]
            ),
            seaportAdapter.interface.encodeFunctionData(
              "approveBeforeFulfill",
              [
                [testERC1155.address],
                0,
                marketplaceContract.interface.encodeFunctionData(
                  "fulfillAdvancedOrder",
                  [order, [], toKey(false), shoyuContract.address]
                ),
              ]
            ),
            transformationAdapter.interface.encodeFunctionData("swapExactIn", [
              parseEther("1"), // amountIn
              BigNumber.from(0), // amountOutMin
              [testERC20.address, testWETH.address], // path
              seller.address, // to
              true, // unwrapNativeToken
            ]),
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

        const sellerETHBalanceAfter = await provider.getBalance(seller.address);

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

    it("User accepts offer on ERC721 for WETH and unwraps to ETH", async () => {
      const nftId = await mintAndApprove721(seller, shoyuContract.address);

      await testWETH.connect(buyer).deposit({ value: parseEther("2") });
      await testWETH
        .connect(buyer)
        .approve(marketplaceContract.address, MaxUint256);

      // buyer creates offer for 1ERC721 at price of 1ERC20 + .1ERC20 fee
      const offer = [
        getTestItem20(
          parseEther("1.1"),
          parseEther("1.1"),
          undefined,
          testWETH.address
        ),
      ];

      const consideration = [
        getTestItem721(nftId, 1, 1, buyer.address),
        getTestItem20(
          parseEther(".1"),
          parseEther(".1"),
          zone.address,
          testWETH.address
        ),
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
      const sellerETHBalanceBefore = await provider.getBalance(seller.address);

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
                TokenSource.WALLET,
                "0x",
              ]
            ),
            seaportAdapter.interface.encodeFunctionData(
              "approveBeforeFulfill",
              [
                [testERC721.address],
                0,
                marketplaceContract.interface.encodeFunctionData(
                  "fulfillAdvancedOrder",
                  [order, [], toKey(false), shoyuContract.address]
                ),
              ]
            ),
            transformationAdapter.interface.encodeFunctionData(
              "unwrapNativeToken",
              [
                parseEther("1"), // amount
                seller.address, // to
              ]
            ),
          ]
        );

        const receipt = await (await tx).wait();

        const sellerETHBalanceAfter = await provider.getBalance(seller.address);

        expect(
          sellerETHBalanceAfter.sub(sellerETHBalanceBefore).abs().toString()
        ).to.eq(
          receipt.effectiveGasPrice
            .mul(receipt.gasUsed)
            .sub(parseEther("1"))
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

    it("Reverts if order cannot be filled after swapping", async () => {
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

      // order is expired
      const { order, orderHash, value } = await createOrder(
        seller,
        zone,
        offer,
        consideration,
        0, // FULL_OPEN
        [],
        "EXPIRED"
      );

      // buyer fills order through Shoyu contract
      // and swaps ERC20 for ETH before filling the order
      await mintAndApproveERC20(buyer, shoyuContract.address, parseEther("5"));

      await expect(
        shoyuContract.connect(buyer).cook(
          [0, 1],
          [
            transformationAdapter.interface.encodeFunctionData("swapExactOut", [
              value, // amountOut
              MaxUint256, // amountInMax
              [testERC20.address, testWETH.address], // path
              shoyuContract.address, // to
              TokenSource.WALLET, // tokenSource
              "0x", // transferData
              true, // unwrapNativeToken
            ]),
            seaportAdapter.interface.encodeFunctionData("fulfill", [
              value,
              marketplaceContract.interface.encodeFunctionData(
                "fulfillAdvancedOrder",
                [order, [], toKey(false), buyer.address]
              ),
            ]),
          ]
        )
      ).to.be.reverted;
    });
  });
});
