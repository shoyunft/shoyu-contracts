import { BigNumber, constants, Contract, Wallet } from "ethers";
import { deployments, ethers, network } from "hardhat";
import { MaxUint256 } from "@ethersproject/constants";
import { expect } from "chai";
import { Interface, parseEther } from "ethers/lib/utils";

import IUNISWAPV2_ABI from "@sushiswap/core/build/abi/IUniswapV2Pair.json";

import { seedSushiswapPools } from "./fixtures/seedSushiswapPools";
import { faucet } from "../utils/impersonate";
import { seaportFixture } from "../utils/fixtures";
import {
  defaultBuyNowMirrorFulfillment,
  getItem721,
  getItemETH,
  randomHex,
  toFulfillmentComponents,
  toKey,
} from "../utils/encoding";
import { deployContract } from "../utils/contracts";
import { shoyuFixture } from "./fixtures/shoyuFixture";

describe(`Shoyu exchange test suite`, function () {
  const provider = ethers.provider;
  let shoyuContract: Contract;
  let zone: Wallet;
  let marketplaceContract: Contract;
  let testERC20: Contract;
  let testERC721: Contract;
  let testERC1155: Contract;
  let testERC1155Two: Contract;
  let testWETH: Contract;
  let owner: Wallet;
  let withBalanceChecks: any;
  let EIP1271WalletFactory: any;
  let reenterer;
  let stubZone: any;
  let conduitController: any;
  let conduitImplementation;
  let conduitOne: any;
  let conduitKeyOne: any;
  let directMarketplaceContract: Contract;
  let mintAndApproveERC20: any;
  let getTestItem20: any;
  let set721ApprovalForAll;
  let mint721;
  let mint721s;
  let mintAndApprove721: any;
  let getTestItem721: any;
  let getTestItem721WithCriteria;
  let mintAndApprove1155: any;
  let getTestItem1155WithCriteria;
  let getTestItem1155: any;
  let deployNewConduit: any;
  let createTransferWithApproval;
  let createOrder: any;
  let createMirrorBuyNowOrder: any;
  let createMirrorAcceptOfferOrder;
  let checkExpectedEvents: any;

  const simulateMatchOrders = async (
    orders: any,
    fulfillments: any,
    caller: Wallet,
    value: BigNumber
  ) => {
    return marketplaceContract
      .connect(caller)
      .callStatic.matchOrders(orders, fulfillments, {
        value,
      });
  };

  after(async () => {
    await network.provider.request({
      method: "hardhat_reset",
    });
  });

  before(async () => {
    owner = new ethers.Wallet(randomHex(32), provider);

    await Promise.all(
      [owner].map((wallet) => faucet(wallet.address, provider))
    );

    ({
      EIP1271WalletFactory,
      reenterer,
      conduitController,
      conduitImplementation,
      conduitKeyOne,
      conduitOne,
      deployNewConduit,
      testERC20,
      mintAndApproveERC20,
      getTestItem20,
      testERC721,
      set721ApprovalForAll,
      mint721,
      mint721s,
      mintAndApprove721,
      getTestItem721,
      getTestItem721WithCriteria,
      testERC1155,
      mintAndApprove1155,
      directMarketplaceContract,
      getTestItem1155WithCriteria,
      getTestItem1155,
      testERC1155Two,
      createTransferWithApproval,
      marketplaceContract,
      stubZone,
      createOrder,
      createMirrorBuyNowOrder,
      createMirrorAcceptOfferOrder,
      withBalanceChecks,
      checkExpectedEvents,
    } = await seaportFixture(owner));

    ({ shoyuContract, testWETH } = await shoyuFixture(
      owner,
      marketplaceContract,
      conduitController
    ));
  });

  describe("Shoyu tests", async () => {
    let seller: Wallet;
    let sellerContract;
    let buyerContract;
    let buyer: Wallet;

    before(async () => {
      // Setup basic buyer/seller wallets with ETH
      seller = new ethers.Wallet(randomHex(32), provider);
      buyer = new ethers.Wallet(randomHex(32), provider);
      zone = new ethers.Wallet(randomHex(32), provider);

      sellerContract = await EIP1271WalletFactory.deploy(seller.address);
      buyerContract = await EIP1271WalletFactory.deploy(buyer.address);

      await Promise.all(
        [seller, buyer, zone, sellerContract, buyerContract].map((wallet) =>
          faucet(wallet.address, provider)
        )
      );
    });

    describe("[SEAPORT] Tests basic order fulfillment", async () => {
      beforeEach(async () => {
        await Promise.all(
          [seller, buyer].map((wallet) => faucet(wallet.address, provider))
        );
      });

      it("Buyer purchases listed ERC721 via fulfillOrder()", async () => {
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
        await withBalanceChecks([order], 0, null, async () => {
          const tx = marketplaceContract
            .connect(buyer)
            .fulfillOrder(order, toKey(false), {
              value,
            });
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

      it("Buyer purchases listed ERC721 via fulfillOrder() with tip", async () => {
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

        order.parameters.consideration.push(
          getItemETH(parseEther(".5"), parseEther(".5"), seller.address)
        );

        const totalValue = value.add(parseEther(".5"));

        // buyer fills order through Shoyu contract
        // and swaps ERC20 for ETH before filling the order
        await withBalanceChecks([order], 0, null, async () => {
          const tx = marketplaceContract
            .connect(buyer)
            .fulfillOrder(order, toKey(false), {
              value: totalValue,
            });
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

      it("Buyer purchases listed ERC721 via fulfillAdvancedOrder()", async () => {
        const nftId = await mintAndApprove721(
          seller,
          marketplaceContract.address
        );

        const offer = [getTestItem721(nftId)];

        const consideration = [
          getItemETH(parseEther("10"), parseEther("10"), seller.address),
          getItemETH(parseEther("1"), parseEther("1"), zone.address),
          getItemETH(parseEther("1"), parseEther("1"), owner.address),
        ];

        const { order, orderHash, value } = await createOrder(
          seller,
          stubZone,
          offer,
          consideration,
          2 // FULL_RESTRICTED
        );

        order.extraData = "0x1234";

        await withBalanceChecks([order], 0, null, async () => {
          const tx = marketplaceContract
            .connect(buyer)
            .fulfillAdvancedOrder(
              order,
              [],
              toKey(false),
              constants.AddressZero,
              {
                value,
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

      it("Orders with different zones can be matched and filled via matchOrders()", async () => {
        const stubZone2 = await deployContract("TestZone", seller as any);

        const nftId = await mintAndApprove721(
          seller,
          marketplaceContract.address
        );

        const offer = [getTestItem721(nftId)];

        const consideration = [
          getItemETH(parseEther("1"), parseEther("1"), seller.address),
          getItemETH(parseEther(".1"), parseEther(".1"), zone.address),
          getItemETH(parseEther(".1"), parseEther(".1"), owner.address),
        ];

        const { order, orderHash, value } = await createOrder(
          seller,
          stubZone,
          offer,
          consideration,
          2 // FULL_OPEN
        );

        const { mirrorOrder, mirrorOrderHash } = await createMirrorBuyNowOrder(
          buyer,
          stubZone2,
          order
        );

        const fulfillments = defaultBuyNowMirrorFulfillment;

        const executions = await simulateMatchOrders(
          [order, mirrorOrder],
          fulfillments,
          owner,
          value
        );
        expect(executions.length).to.equal(4);

        const tx = marketplaceContract
          .connect(owner)
          .matchOrders([order, mirrorOrder], fulfillments, {
            value,
          });
        const receipt = await (await tx).wait();
        await checkExpectedEvents(
          tx,
          receipt,
          [
            {
              order,
              orderHash,
              fulfiller: constants.AddressZero,
            },
            {
              order: mirrorOrder,
              orderHash: mirrorOrderHash,
              fulfiller: constants.AddressZero,
            },
          ],
          executions
        );
        return receipt;
      });

      it("Buyer pays fees when offer is accepted", async () => {
        // buyer creates listing for 1ERC721 at price of 1WETH + .1WETH fee
        await mintAndApproveERC20(
          buyer,
          marketplaceContract.address,
          parseEther("2")
        );

        const nftId = await mintAndApprove721(
          seller,
          marketplaceContract.address
        );

        const offer = [
          getTestItem20(parseEther("1"), parseEther("1"), undefined),
          getTestItem20(parseEther(".1"), parseEther(".1"), zone.address),
        ];

        const consideration = [getTestItem721(nftId, 1, 1, buyer.address)];

        const { order, orderHash, value } = await createOrder(
          buyer,
          zone,
          offer,
          consideration,
          0 // FULL_OPEN
        );

        // buyer fills order through Shoyu contract
        // and swaps ERC20 for ETH before filling the order
        await withBalanceChecks([order], 0, null, async () => {
          const tx = marketplaceContract
            .connect(seller)
            .fulfillOrder(order, toKey(false));
          const receipt = await (await tx).wait();
          await checkExpectedEvents(tx, receipt, [
            {
              order,
              orderHash,
              fulfiller: seller.address,
            },
          ]);
          return receipt;
        });
      });
    });

    describe("[SHOYU] Tests sushiswap integration", async () => {
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

      it("User buys listed ERC721 by swapping ERC20 -> ETH", async () => {
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
        await mintAndApproveERC20(
          buyer,
          shoyuContract.address,
          parseEther("5")
        );

        await withBalanceChecks([order], 0, null, async () => {
          const tx = shoyuContract.connect(buyer).swapForETHAndFulfillOrders(
            [
              {
                path: [testERC20.address, testWETH.address],
                amountInMax: MaxUint256,
                amountOut: value,
              },
            ],
            marketplaceContract.interface.encodeFunctionData(
              "fulfillAdvancedOrder",
              [order, [], toKey(false), buyer.address]
            ),
            toKey(false)
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

      it("User buys listed ERC721 by unwrapping WETH -> ETH", async () => {
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
        await testWETH
          .connect(buyer)
          .approve(shoyuContract.address, MaxUint256);

        await withBalanceChecks([order], 0, null, async () => {
          const tx = shoyuContract.connect(buyer).swapForETHAndFulfillOrders(
            [
              {
                path: [testWETH.address],
                amountInMax: value,
                amountOut: value,
              },
            ],
            marketplaceContract.interface.encodeFunctionData(
              "fulfillAdvancedOrder",
              [order, [], toKey(false), buyer.address]
            ),
            toKey(false)
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

      it("User buys listed ERC721 by swapping ERC20 -> ETH (with conduit)", async () => {
        await conduitController
          .connect(owner)
          .updateChannel(conduitOne.address, shoyuContract.address, true);

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
          const tx = shoyuContract.connect(buyer).swapForETHAndFulfillOrders(
            [
              {
                path: [testERC20.address, testWETH.address],
                amountInMax: MaxUint256,
                amountOut: value,
              },
            ],
            marketplaceContract.interface.encodeFunctionData(
              "fulfillAdvancedOrder",
              [order, [], toKey(false), buyer.address]
            ),
            conduitKeyOne
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
        await mintAndApproveERC20(
          buyer,
          shoyuContract.address,
          parseEther("5")
        );

        await withBalanceChecks([order], 0, null, async () => {
          const tx = shoyuContract.connect(buyer).swapForETHAndFulfillOrders(
            [
              {
                path: [testERC20.address, testWETH.address],
                amountInMax: MaxUint256,
                amountOut: value,
              },
            ],
            marketplaceContract.interface.encodeFunctionData(
              "fulfillAdvancedOrder",
              [order, [], toKey(false), buyer.address]
            ),
            toKey(false)
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
        await mintAndApproveERC20(
          buyer,
          shoyuContract.address,
          parseEther("5")
        );

        await withBalanceChecks([order], 0, null, async () => {
          const tx = shoyuContract.connect(buyer).swapForETHAndFulfillOrders(
            [
              {
                path: [testERC20.address, testWETH.address],
                amountInMax: MaxUint256,
                amountOut: value.div(2),
              },
            ],
            marketplaceContract.interface.encodeFunctionData(
              "fulfillAdvancedOrder",
              [order, [], toKey(false), buyer.address]
            ),
            toKey(false),
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
        const offer1 = [
          getTestItem1155(erc1155Id, erc1155Amount, erc1155Amount),
        ];

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
        await mintAndApproveERC20(
          buyer,
          shoyuContract.address,
          parseEther("5")
        );

        const offerComponents = [[[0, 0]], [[1, 0]]].map(
          toFulfillmentComponents
        );

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

        await withBalanceChecks([order0, order1], 0, null, async () => {
          const tx = shoyuContract.connect(buyer).swapForETHAndFulfillOrders(
            [
              {
                path: [testERC20.address, testWETH.address],
                amountInMax: MaxUint256,
                amountOut: value0.add(value1),
              },
            ],
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
            toKey(false)
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
        const offer1 = [
          getTestItem1155(erc1155Id, erc1155Amount, erc1155Amount),
        ];

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
        await mintAndApproveERC20(
          buyer,
          shoyuContract.address,
          parseEther("5")
        );

        const offerComponents = [[[0, 0]], [[1, 0]]].map(
          toFulfillmentComponents
        );

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
          const tx = shoyuContract.connect(buyer).swapForETHAndFulfillOrders(
            [
              {
                path: [testERC20.address, testWETH.address],
                amountInMax: MaxUint256,
                amountOut: totalValue.div(2),
              },
            ],
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
            toKey(false),
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
        await mintAndApproveERC20(
          buyer,
          shoyuContract.address,
          parseEther("5")
        );

        const buyerETHBalanceBefore = await provider.getBalance(buyer.address);

        await withBalanceChecks([order], 0, null, async () => {
          const tx = shoyuContract.connect(buyer).swapForETHAndFulfillOrders(
            [
              {
                path: [testERC20.address, testWETH.address],
                amountInMax: MaxUint256,
                amountOut: value.add(42069),
              },
            ],
            marketplaceContract.interface.encodeFunctionData(
              "fulfillAdvancedOrder",
              [order, [], toKey(false), buyer.address]
            ),
            toKey(false)
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
        await mintAndApproveERC20(
          buyer,
          shoyuContract.address,
          parseEther("5")
        );

        const buyerETHBalanceBefore = await provider.getBalance(buyer.address);
        const offerComponents = [[[0, 0]], [[1, 0]]].map(
          toFulfillmentComponents
        );

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
          const tx = await shoyuContract
            .connect(buyer)
            .swapForETHAndFulfillOrders(
              [
                {
                  path: [testERC20.address, testWETH.address],
                  amountInMax: MaxUint256,
                  amountOut: totalValue,
                },
              ],
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
              toKey(false)
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
        await mintAndApproveERC20(
          buyer,
          shoyuContract.address,
          parseEther("5")
        );

        await expect(
          shoyuContract.connect(buyer).swapForETHAndFulfillOrders(
            [
              {
                path: [testERC20.address, testWETH.address],
                amountInMax: MaxUint256,
                amountOut: value,
              },
            ],
            marketplaceContract.interface.encodeFunctionData(
              "fulfillAdvancedOrder",
              [order, [], toKey(false), buyer.address]
            ),
            toKey(false)
          )
        ).to.be.reverted;
      });
    });
  });
});
