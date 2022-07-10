import { Contract, Wallet } from "ethers";
import { ethers, network } from "hardhat";
import { AddressZero, MaxUint256 } from "@ethersproject/constants";
import { expect } from "chai";
import { parseEther } from "ethers/lib/utils";

import { seedSushiswapPools } from "./utils/fixtures/sushi";
import { faucet } from "./utils/impersonate";
import { seaportFixture } from "./utils/fixtures";
import { getItemETH, randomHex, toKey } from "./utils/encoding";
import { shoyuFixture } from "./utils/fixtures/shoyu";
import { TokenSource } from "./utils/contsants";
import {
  encodeFulfillAdvancedOrderParams,
  signBentoMasterContractApproval,
} from "./utils/helpers";

describe("[BENTOBOX] Tests", function () {
  const provider = ethers.provider;
  let shoyuContract: Contract;
  let transformationAdapter: Contract;
  let seaportAdapter: Contract;
  let bentobox: Contract;
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

    ({
      shoyuContract,
      testWETH,
      transformationAdapter,
      seaportAdapter,
      bentobox,
    } = await shoyuFixture(
      owner,
      marketplaceContract,
      conduitController,
      testERC20
    ));
  });

  describe("[SEAPORT + BENTOBOX]", async () => {
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

    it("User buys ERC721 listed in ETH with WETH in bentobox", async () => {
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
      // by paying with WETH from bentobox
      await bentobox
        .connect(buyer)
        .deposit(
          AddressZero,
          buyer.address,
          buyer.address,
          parseEther("2"),
          0,
          {
            value: parseEther("2"),
          }
        );

      const { v, r, s } = await signBentoMasterContractApproval(
        bentobox,
        buyer,
        shoyuContract.address
      );

      await bentobox
        .connect(buyer)
        .setMasterContractApproval(
          buyer.address,
          shoyuContract.address,
          true,
          v,
          r,
          s
        );

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
                TokenSource.BENTO, // tokenSource
                toKey(true), // transferData
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

    it("User accepts offer on ERC721 for ERC20 and deposits in bentobox", async () => {
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
      // and deposits received ERC20 in bentobox
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
                encodeFulfillAdvancedOrderParams(
                  order,
                  [],
                  toKey(false),
                  shoyuContract.address
                ),
              ]
            ),
            transformationAdapter.interface.encodeFunctionData(
              "depositERC20ToBentoBox",
              [
                testERC20.address, // token
                seller.address, // to
                parseEther("1"), // amount
                0, // share
                0, // value
              ]
            ),
          ]
        );

        const receipt = await (await tx).wait();

        const bentoDepositEvent = receipt.events
          .filter((event: any) => {
            try {
              bentobox.interface.decodeEventLog(
                "LogDeposit",
                event.data,
                event.topics
              );
              return true;
            } catch (e) {
              return false;
            }
          })
          .map((event: any) =>
            bentobox.interface.decodeEventLog(
              "LogDeposit",
              event.data,
              event.topics
            )
          )[0];

        expect(bentoDepositEvent.amount.toString()).to.eq(
          parseEther("1").toString()
        );

        const sellerBentoBalance = await bentobox.balanceOf(
          testERC20.address,
          seller.address
        );

        expect(sellerBentoBalance.toString()).to.eq(parseEther("1").toString());

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

    it("User accepts offer on ERC721 for WETH and deposits in bentobox", async () => {
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
      // and deposits received ERC20 in bentobox
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
                encodeFulfillAdvancedOrderParams(
                  order,
                  [],
                  toKey(false),
                  shoyuContract.address
                ),
              ]
            ),
            transformationAdapter.interface.encodeFunctionData(
              "depositERC20ToBentoBox",
              [
                testWETH.address, // token
                seller.address, // to
                parseEther("1"), // amount
                0, // share
                0, // value
              ]
            ),
          ]
        );

        const receipt = await (await tx).wait();

        const bentoDepositEvent = receipt.events
          .filter((event: any) => {
            try {
              bentobox.interface.decodeEventLog(
                "LogDeposit",
                event.data,
                event.topics
              );
              return true;
            } catch (e) {
              return false;
            }
          })
          .map((event: any) =>
            bentobox.interface.decodeEventLog(
              "LogDeposit",
              event.data,
              event.topics
            )
          )[0];

        expect(bentoDepositEvent.amount.toString()).to.eq(
          parseEther("1").toString()
        );

        const sellerBentoBalance = await bentobox.balanceOf(
          testWETH.address,
          seller.address
        );

        expect(sellerBentoBalance.toString()).to.eq(parseEther("1").toString());

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
  });
});
