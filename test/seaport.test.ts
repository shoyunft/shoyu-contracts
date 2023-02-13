import { BigNumber, constants, Contract, Wallet } from "ethers";
import { ethers, network } from "hardhat";
import { MaxUint256 } from "@ethersproject/constants";
import { expect } from "chai";
import { parseEther } from "ethers/lib/utils";

import { faucet } from "./utils/impersonate";
import { seaportFixture } from "./utils/fixtures";
import {
  defaultBuyNowMirrorFulfillment,
  getItemETH,
  randomHex,
  toKey,
} from "./utils/encoding";
import { deployContract } from "./utils/contracts";

describe("[SEAPORT] Tests", function () {
  const provider = ethers.provider;
  let zone: Wallet;
  let marketplaceContract: Contract;
  let testERC20: Contract;
  let owner: Wallet;
  let withBalanceChecks: any;
  let stubZone: any;
  let mintAndApproveERC20: any;
  let getTestItem20: any;
  let mintAndApprove721: any;
  let getTestItem721: any;
  let createOrder: any;
  let createMirrorBuyNowOrder: any;
  let checkExpectedEvents: any;
  let seller: Wallet;
  let buyer: Wallet;

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
    seller = new ethers.Wallet(randomHex(32), provider);
    buyer = new ethers.Wallet(randomHex(32), provider);
    zone = new ethers.Wallet(randomHex(32), provider);

    await Promise.all(
      [owner, seller, buyer, zone].map((wallet) =>
        faucet(wallet.address, provider)
      )
    );

    ({
      testERC20,
      mintAndApproveERC20,
      getTestItem20,
      mintAndApprove721,
      getTestItem721,
      marketplaceContract,
      stubZone,
      createOrder,
      createMirrorBuyNowOrder,
      withBalanceChecks,
      checkExpectedEvents,
    } = await seaportFixture(owner));
  });

  describe("Tests basic seaport functionality", async () => {
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
            fulfiller: owner.address,
          },
          {
            order: mirrorOrder,
            orderHash: mirrorOrderHash,
            fulfiller: owner.address,
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

      const offer = [getTestItem20(parseEther("1.1"), parseEther("1.1"))];

      const consideration = [
        getTestItem721(nftId, 1, 1, buyer.address),
        getTestItem20(parseEther(".1"), parseEther(".1"), zone.address),
      ];

      await testERC20
        .connect(seller)
        .approve(marketplaceContract.address, MaxUint256);

      const { order, orderHash } = await createOrder(
        buyer,
        zone,
        offer,
        consideration,
        0 // FULL_OPEN
      );

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
});
