import { ChainId } from "@sushiswap/core-sdk";

export const CONDUIT_CONTROLLER_ADDRESS: { [chainId: number]: string } = {
  [ChainId.ETHEREUM]: "0x00000000F9490004C11Cef243f5400493c00Ad63",
  [ChainId.RINKEBY]: "0x00000000F9490004C11Cef243f5400493c00Ad63",
  [ChainId.GÖRLI]: "0x00000000F9490004C11Cef243f5400493c00Ad63",
};

export const SEAPORT_ADDRESS_1_1: { [chainId: number]: string } = {
  [ChainId.ETHEREUM]: "0x00000000006c3852cbef3e08e8df289169ede581",
  [ChainId.RINKEBY]: "0x00000000006c3852cbef3e08e8df289169ede581",
  [ChainId.GÖRLI]: "0x00000000006c3852cbEf3e08E8dF289169EdE581",
};

// TODO
export const SEAPORT_ADDRESS_1_2: { [chainId: number]: string } = {
  [ChainId.ETHEREUM]: "",
  [ChainId.RINKEBY]: "",
  [ChainId.GÖRLI]: "",
};

export const SEAPORT_ADDRESS = SEAPORT_ADDRESS_1_1;
