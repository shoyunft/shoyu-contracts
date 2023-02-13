import { ethers } from "ethers";

export function encodedSwapData(
  tokenIn: string,
  to: string,
  unwrapBento: boolean
) {
  return ethers.utils.defaultAbiCoder.encode(
    ["address", "address", "bool"],
    [tokenIn, to, unwrapBento]
  );
}
