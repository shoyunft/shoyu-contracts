import { ChainId } from "@sushiswap/core-sdk";

export const CONDUIT_CONTROLLER_ADDRESS: { [chainId: number]: string } = {
  [ChainId.ETHEREUM]: "0x00000000006ce100a8b5ed8edf18ceef9e500697",
  [ChainId.RINKEBY]: "0x00000000006ce100a8b5ed8edf18ceef9e500697",
  [ChainId.GÖRLI]: "0x00000000006ce100a8b5ed8edf18ceef9e500697",
};

export const SEAPORT_ADDRESS: { [chainId: number]: string } = {
  [ChainId.ETHEREUM]: "0x00000000006c3852cbef3e08e8df289169ede581",
  [ChainId.RINKEBY]: "0x00000000006c3852cbef3e08e8df289169ede581",
  [ChainId.GÖRLI]: "0x00000000006c3852cbEf3e08E8dF289169EdE581",
};
