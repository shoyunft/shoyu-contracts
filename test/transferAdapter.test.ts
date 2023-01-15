import { Contract, Wallet } from "ethers";
import { ethers, network } from "hardhat";
import { MaxUint256 } from "@ethersproject/constants";
import { expect } from "chai";
import { parseEther } from "ethers/lib/utils";

import { faucet } from "./utils/impersonate";
import { seaportFixture } from "./utils/fixtures";
import { randomHex, toFulfillmentComponents, toKey } from "./utils/encoding";
import { shoyuFixture } from "./utils/fixtures/shoyu";
import { TokenSource } from "./utils/contsants";
import {
  encodeFulfillAdvancedOrderParams,
  encodeFulfillAvailableAdvancedOrdersParams,
} from "./utils/helpers";

describe("[Transfer] Tests", function () {
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
  let mintAndApprove721: any;
  let mintAndApprove1155: any;
  let getTestItem20: any;
  let getTestItem721: any;
  let getTestItem1155: any;
  let createOrder: any;
  let checkExpectedEvents: any;
  let seller: Wallet;
  let buyer: Wallet;
  let conduitOne: Contract;

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
      conduitController,
      testERC20,
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

    ({ shoyuContract, testWETH, transformationAdapter, seaportAdapter } =
      await shoyuFixture(
        owner,
        marketplaceContract,
        conduitController,
        testERC20
      ));

    await conduitController
      .connect(owner)
      .updateChannel(conduitOne.address, shoyuContract.address, true);
  });

  describe("Tests return asset functions", async () => {
    it("User can return excess ERC20 tokens", async () => {
      // buyer creates offer for 1ERC721 at price of 1WETH + .1WETH fee
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

      await withBalanceChecks([order], 0, null, async () => {
        const tx = shoyuContract
          .connect(seller)
          .cook(
            [0, 1, 0, 0],
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
                  encodeFulfillAdvancedOrderParams(
                    order,
                    [],
                    toKey(false),
                    shoyuContract.address
                  ),
                ]
              ),
              transformationAdapter.interface.encodeFunctionData(
                "returnERC20",
                [testWETH.address]
              ),
              transformationAdapter.interface.encodeFunctionData(
                "returnERC20",
                [testWETH.address]
              ),
            ]
          );

        const receipt = await (await tx).wait();

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

    it("User can return excess ERC721 asset", async () => {
      // buyer creates 2 offers for 1ERC721 at price of 1WETH + .1WETH fee each
      const nftId0 = await mintAndApprove721(seller, shoyuContract.address);

      const nftId1 = await mintAndApprove721(seller, shoyuContract.address);

      const offer = [
        getTestItem20(
          parseEther("1.1"),
          parseEther("1.1"),
          undefined,
          testWETH.address
        ),
      ];

      const consideration0 = [
        getTestItem721(nftId0, 1, 1, buyer.address),
        getTestItem20(
          parseEther(".1"),
          parseEther(".1"),
          zone.address,
          testWETH.address
        ),
      ];

      const consideration1 = [
        getTestItem721(nftId1, 1, 1, buyer.address),
        getTestItem20(
          parseEther(".1"),
          parseEther(".1"),
          zone.address,
          testWETH.address
        ),
      ];

      const { order: order0, orderHash: orderHash0 } = await createOrder(
        buyer,
        zone,
        offer,
        consideration0,
        0 // FULL_OPEN
      );

      const { order: order1 } = await createOrder(
        buyer,
        zone,
        offer,
        consideration1,
        0, // FULL_OPEN
        [],
        "EXPIRED"
      );

      await testWETH.connect(buyer).deposit({ value: parseEther("5") });
      await testWETH
        .connect(buyer)
        .approve(marketplaceContract.address, MaxUint256);

      consideration0.push(
        getTestItem20(
          parseEther("1.0"),
          parseEther("1.0"),
          seller.address,
          testWETH.address
        )
      );

      consideration1.push(
        getTestItem20(
          parseEther("1.0"),
          parseEther("1.0"),
          seller.address,
          testWETH.address
        )
      );

      const offerComponents = [
        [
          [0, 0],
          [1, 0],
        ],
      ].map(toFulfillmentComponents);

      const considerationComponents = [
        [[0, 0]],
        [[1, 0]],
        [
          [0, 1],
          [1, 1],
        ],
        [
          [0, 2],
          [1, 2],
        ],
      ].map(toFulfillmentComponents);

      // seller accepts offer on NFT
      await withBalanceChecks([order0], 0, null, async () => {
        const tx = shoyuContract
          .connect(seller)
          .cook(
            [0, 0, 1, 0, 0],
            [
              transformationAdapter.interface.encodeFunctionData(
                "transferERC721From",
                [
                  testERC721.address,
                  shoyuContract.address,
                  nftId0,
                  TokenSource.WALLET,
                  "0x",
                ]
              ),
              transformationAdapter.interface.encodeFunctionData(
                "transferERC721From",
                [
                  testERC721.address,
                  shoyuContract.address,
                  nftId1,
                  TokenSource.WALLET,
                  "0x",
                ]
              ),
              seaportAdapter.interface.encodeFunctionData(
                "approveBeforeFulfillBatch",
                [
                  [testERC721.address],
                  0,
                  encodeFulfillAvailableAdvancedOrdersParams(
                    [order0, order1],
                    [],
                    offerComponents,
                    considerationComponents,
                    toKey(false),
                    shoyuContract.address,
                    2
                  ),
                  false,
                ]
              ),
              transformationAdapter.interface.encodeFunctionData(
                "returnERC721",
                [testERC721.address, nftId0]
              ),
              transformationAdapter.interface.encodeFunctionData(
                "returnERC721",
                [testERC721.address, nftId1]
              ),
            ]
          );

        const receipt = await (await tx).wait();

        await checkExpectedEvents(
          tx,
          receipt,
          [
            {
              order: order0,
              orderHash: orderHash0,
              fulfiller: shoyuContract.address,
            },
          ],
          [
            {
              item: consideration0[0],
              offerer: shoyuContract.address,
              conduitKey: toKey(false),
            },
            {
              item: { ...consideration0[2], amount: parseEther("1") },
              offerer: shoyuContract.address,
              conduitKey: toKey(false),
            },
          ]
        );
        return receipt;
      });

      expect((await testERC721.ownerOf(nftId1)).toLowerCase()).to.eq(
        seller.address.toLowerCase()
      );
    });

    it("User can return excess ERC1155 asset", async () => {
      // buyer creates offer for ERC1155 at price of 1WETH + .1WETH fee each
      const { nftId, amount } = await mintAndApprove1155(
        seller,
        shoyuContract.address,
        1,
        undefined,
        1000
      );

      const offer = [
        getTestItem20(
          parseEther("1.1"),
          parseEther("1.1"),
          undefined,
          testWETH.address
        ),
      ];

      const consideration = [
        getTestItem1155(
          nftId,
          amount.div(2),
          amount.div(2),
          undefined,
          buyer.address
        ),
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

      await testWETH.connect(buyer).deposit({ value: parseEther("5") });
      await testWETH
        .connect(buyer)
        .approve(marketplaceContract.address, MaxUint256);

      consideration.push(
        getTestItem20(
          parseEther("1"),
          parseEther("1"),
          seller.address,
          testWETH.address
        )
      );

      // seller accepts offer on NFT
      await withBalanceChecks([order], 0, null, async () => {
        const tx = shoyuContract
          .connect(seller)
          .cook(
            [0, 1, 0, 0],
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
                  encodeFulfillAdvancedOrderParams(
                    order,
                    [],
                    toKey(false),
                    shoyuContract.address
                  ),
                ]
              ),
              transformationAdapter.interface.encodeFunctionData(
                "returnERC1155",
                [testERC1155.address, nftId]
              ),
              transformationAdapter.interface.encodeFunctionData(
                "returnERC1155",
                [testERC1155.address, nftId]
              ),
            ]
          );

        const receipt = await (await tx).wait();

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
              item: { ...consideration[0], amount: amount.div(2) },
              offerer: shoyuContract.address,
              conduitKey: toKey(false),
              operator: marketplaceContract.address,
            },
            {
              item: { ...consideration[2], amount: parseEther("1") },
              offerer: shoyuContract.address,
              conduitKey: toKey(false),
            },
          ]
        );
        return receipt;
      });

      expect(
        (await testERC1155.balanceOf(seller.address, nftId)).toString()
      ).to.eq(amount.div(2).toString());
    });
  });
});
