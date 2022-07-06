import { Contract, Wallet } from "ethers";
import { ethers, network } from "hardhat";
import { AddressZero } from "@ethersproject/constants";
import { expect } from "chai";

import { faucet } from "./utils/impersonate";
import { seaportFixture } from "./utils/fixtures";
import { randomHex } from "./utils/encoding";
import { shoyuFixture } from "./utils/fixtures/shoyu";

describe("[REGISTRY] Tests", function () {
  const provider = ethers.provider;
  let zone: Wallet;
  let marketplaceContract: Contract;
  let testERC20: Contract;
  let owner: Wallet;
  let conduitController: any;
  let seller: Wallet;
  let buyer: Wallet;
  let adapterRegistry: Contract;

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

    ({ conduitController, testERC20, marketplaceContract } =
      await seaportFixture(owner));

    ({ adapterRegistry } = await shoyuFixture(
      owner,
      marketplaceContract,
      conduitController,
      testERC20
    ));
  });

  describe("Tests AdapterRegistry", async () => {
    beforeEach(async () => {
      await Promise.all(
        [seller, buyer].map((wallet) => faucet(wallet.address, provider))
      );
    });

    it("setAdapterAddress() works as expected", async () => {
      const addAdapterTx = await adapterRegistry.addAdapter(zone.address);
      await addAdapterTx.wait();

      const setAdapterAdressTx = await adapterRegistry.setAdapterAddress(
        2,
        AddressZero
      );
      await setAdapterAdressTx.wait();

      const { adapterAddress } = await adapterRegistry.adapters(2);

      expect(adapterAddress).to.be.eq(AddressZero);
    });

    it("setAdapterStatus() works as expected", async () => {
      const addAdapterTx = await adapterRegistry.addAdapter(zone.address);
      await addAdapterTx.wait();

      const { isActive: isActiveBefore } = await adapterRegistry.adapters(2);

      const setAdapterAdressTx = await adapterRegistry.setAdapterStatus(
        2,
        false
      );
      await setAdapterAdressTx.wait();

      const { isActive: isActiveAfter } = await adapterRegistry.adapters(2);

      expect(isActiveAfter).to.be.eq(false);
      expect(isActiveAfter).to.not.eq(isActiveBefore);
    });
  });
});
