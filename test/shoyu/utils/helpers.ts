import { splitSignature } from "@ethersproject/bytes";
import { Contract } from "@ethersproject/contracts";
import { Wallet } from "@ethersproject/wallet";

export async function signBentoMasterContractApproval(
  bentobox: Contract,
  user: Wallet,
  contractToApprove: string,
  approved = true
) {
  const nonces = await bentobox.nonces(user.address);

  const signature = await user._signTypedData(
    {
      name: "BentoBox V1",
      chainId: 31337,
      verifyingContract: bentobox.address,
    },
    {
      SetMasterContractApproval: [
        { name: "warning", type: "string" },
        { name: "user", type: "address" },
        { name: "masterContract", type: "address" },
        { name: "approved", type: "bool" },
        { name: "nonce", type: "uint256" },
      ],
    },
    {
      warning: "Give FULL access to funds in (and approved to) BentoBox?",
      user: user.address,
      masterContract: contractToApprove,
      approved,
      nonce: nonces,
    }
  );

  return splitSignature(signature);
}
