import { Contract, Wallet } from "ethers";
import { ethers, network } from "hardhat";
import { parseEther } from "ethers/lib/utils";

import { seedSushiswapPools } from "./utils/fixtures/sushi";
import { faucet } from "./utils/impersonate";
import { seaportFixture } from "./utils/fixtures";
import { randomHex, toKey } from "./utils/encoding";
import { shoyuFixture } from "./utils/fixtures/shoyu";
import { TokenSource } from "./utils/contsants";
import { encodeFulfillAdvancedOrderParams } from "./utils/helpers";

describe("[CONDUIT] Tests", function () {
  const provider = ethers.provider;
  let shoyuContract: Contract;
  let transformationAdapter: Contract;
  let seaportAdapter: Contract;
  let zone: Wallet;
  let marketplaceContract: Contract;
  let testERC20: Contract;
  let testERC721: Contract;
  let testWETH: Contract;
  let owner: Wallet;
  let withBalanceChecks: any;
  let conduitController: any;
  let conduitOne: any;
  let conduitKeyOne: any;
  let mintAndApproveERC20: any;
  let getTestItem20: any;
  let mintAndApprove721: any;
  let getTestItem721: any;
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
      conduitKeyOne,
      conduitOne,
      testERC20,
      mintAndApproveERC20,
      getTestItem20,
      testERC721,
      mintAndApprove721,
      getTestItem721,
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

  describe("[SEAPORT + CONDUIT]", async () => {
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

    it("User buys ERC721 listed in ERC20 using conduit", async () => {
      const nftId = await mintAndApprove721(
        seller,
        marketplaceContract.address
      );

      await mintAndApproveERC20(buyer, conduitOne.address, parseEther("5"));

      // seller lists ERC721 at price of 1ERC20 + .1ERC20 fee
      const offer = [getTestItem721(nftId)];

      const consideration = [
        getTestItem20(parseEther("1"), parseEther("1"), seller.address),
        getTestItem20(parseEther(".1"), parseEther(".1"), zone.address),
      ];

      const { order, orderHash } = await createOrder(
        seller,
        zone,
        offer,
        consideration,
        0 // FULL_OPEN
      );

      const totalERC20 = parseEther("1.1");

      await withBalanceChecks([order], 0, null, async () => {
        const tx = shoyuContract
          .connect(buyer)
          .cook(
            [0, 1],
            [
              transformationAdapter.interface.encodeFunctionData(
                "transferERC20From",
                [
                  testERC20.address,
                  shoyuContract.address,
                  totalERC20,
                  TokenSource.CONDUIT,
                  conduitKeyOne,
                ]
              ),
              seaportAdapter.interface.encodeFunctionData("fulfill", [
                0,
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
              item: { ...offer[0], recipient: buyer.address },
              offerer: seller.address,
              conduitKey: toKey(false),
            },
          ]
        );
        return receipt;
      });
    });

    it("User accepts offer on ERC721 for WETH using conduit", async () => {
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
      consideration.push(
        getTestItem20(parseEther("1"), parseEther("1"), seller.address)
      );

      await withBalanceChecks([order], 0, null, async () => {
        const tx = shoyuContract
          .connect(seller)
          .cook(
            [0, 1],
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
              item: {
                ...order.parameters.consideration[2],
                amount: parseEther("1"),
              },
              offerer: shoyuContract.address,
              conduitKey: toKey(false),
            },
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
  });
});
