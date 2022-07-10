import { Contract, Wallet } from "ethers";
import { ethers, network } from "hardhat";
import { expect } from "chai";
import { parseEther } from "ethers/lib/utils";

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
import { encodeFulfillAvailableAdvancedOrdersParams } from "./utils/helpers";

describe("[SEAPORT] Adapter Tests", function () {
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

  describe("Tests seaportAdapter", async () => {
    beforeEach(async () => {
      await Promise.all(
        [seller, buyer].map((wallet) => faucet(wallet.address, provider))
      );
    });

    it("Excess ETH is refunded if one or more orders cannot be filled when buying in bulk", async () => {
      // seller creates 2 listings for ERC1155, each with a total price of 1ETH + .1ETH fee
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

      const buyerETHBalanceBefore = await provider.getBalance(buyer.address);

      await withBalanceChecks([order0.order], 0, null, async () => {
        const tx = await shoyuContract
          .connect(buyer)
          .cook(
            [1],
            [
              seaportAdapter.interface.encodeFunctionData("fulfillBatch", [
                totalValue,
                encodeFulfillAvailableAdvancedOrdersParams(
                  [order0.order, order1.order],
                  [],
                  offerComponents,
                  considerationComponents,
                  toKey(false),
                  buyer.address,
                  2
                ),
                false,
              ]),
            ],
            {
              value: totalValue,
            }
          );

        const receipt = await (await tx).wait();

        const buyerETHBalanceAfter = await provider.getBalance(buyer.address);

        expect(
          buyerETHBalanceBefore.sub(buyerETHBalanceAfter).toString()
        ).to.eq(
          receipt.effectiveGasPrice
            .mul(receipt.gasUsed)
            .add(order0.value)
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

    it("fulfillBatch reverts if one or more orders cannot be filled and `revertIfIncomplete` is true", async () => {
      // buyer creates 2 offers for ERC1155, each at a total price of 1ETH + .1ETH fee
      const { amount, nftId } = await mintAndApprove1155(
        seller,
        shoyuContract.address,
        1,
        undefined,
        500
      );

      await mintAndApproveERC20(
        buyer,
        marketplaceContract.address,
        parseEther("5")
      );

      const offer = [getTestItem20(parseEther("1.1"), parseEther("1.1"))];

      const consideration = [
        getTestItem1155(
          nftId,
          amount.div(2),
          amount.div(2),
          undefined,
          buyer.address
        ),
        getTestItem20(parseEther(".1"), parseEther(".1"), zone.address),
      ];

      const order0 = await createOrder(
        buyer,
        zone,
        offer,
        consideration,
        0 // FULL_OPEN
      );

      const order1 = await createOrder(
        buyer,
        zone,
        offer,
        consideration,
        0, // FULL_OPEN
        [],
        "EXPIRED"
      );

      consideration.push(
        getTestItem20(parseEther("1"), parseEther("1"), seller.address)
      );

      const offerComponents = [
        [
          [0, 0],
          [1, 0],
        ],
      ].map(toFulfillmentComponents);

      const considerationComponents = [
        [
          [0, 0],
          [1, 0],
        ],
        [
          [0, 1],
          [1, 1],
        ],
        [
          [0, 2],
          [1, 2],
        ],
      ].map(toFulfillmentComponents);

      await expect(
        shoyuContract
          .connect(seller)
          .cook(
            [0, 1],
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
                "approveBeforeFulfillBatch",
                [
                  [testERC1155.address, testERC1155.address],
                  0,
                  encodeFulfillAvailableAdvancedOrdersParams(
                    [order0.order, order1.order],
                    [],
                    offerComponents,
                    considerationComponents,
                    toKey(false),
                    shoyuContract.address,
                    2
                  ),
                  true,
                ]
              ),
            ]
          )
      ).to.be.reverted;
    });

    it("fulfillBatch reverts if seaport call fails", async () => {
      // buyer creates 2 offers for ERC1155, each at a total price of 1ETH + .1ETH fee
      const { amount, nftId } = await mintAndApprove1155(
        seller,
        shoyuContract.address,
        1,
        undefined,
        500
      );

      await mintAndApproveERC20(
        buyer,
        marketplaceContract.address,
        parseEther("5")
      );

      const offer = [getTestItem20(parseEther("1.1"), parseEther("1.1"))];

      const consideration = [
        getTestItem1155(
          nftId,
          amount.div(2),
          amount.div(2),
          undefined,
          buyer.address
        ),
        getTestItem20(parseEther(".1"), parseEther(".1"), zone.address),
      ];

      const order0 = await createOrder(
        buyer,
        zone,
        offer,
        consideration,
        0 // FULL_OPEN
      );

      const order1 = await createOrder(
        buyer,
        zone,
        offer,
        consideration,
        0, // FULL_OPEN
        [],
        "EXPIRED"
      );

      consideration.push(
        getTestItem20(parseEther("1"), parseEther("1"), seller.address)
      );

      const offerComponents = [
        [
          [0, 0],
          [1, 0],
        ],
      ].map(toFulfillmentComponents);

      const considerationComponents = [
        [
          [0, 0],
          [1, 0],
        ],
        [
          [0, 1],
          [1, 1],
        ],
        [
          [0, 2],
          [1, 2],
        ],
      ].map(toFulfillmentComponents);

      await expect(
        shoyuContract.connect(seller).cook(
          [0, 1],
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
              "approveBeforeFulfillBatch",
              [
                [testERC1155.address, testERC1155.address],
                0,
                encodeFulfillAvailableAdvancedOrdersParams(
                  [order0.order, order1.order],
                  [],
                  offerComponents,
                  considerationComponents,
                  toKey(true), // <- invalid key sent
                  shoyuContract.address,
                  2
                ),
                true,
              ]
            ),
          ]
        )
      ).to.be.reverted;
    });
  });
});
