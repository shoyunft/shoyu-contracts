const { getNamedAccounts, deployments } = require("hardhat");
const readlineSync = require("readline-sync");

async function main() {
  const adapterId = readlineSync.question("Adapter Id: ");
  const newAdapterAddress = readlineSync.question("New Adapter Address: ");
  const { deployer } = await getNamedAccounts();
  const { execute } = deployments;
  console.log("Submitting tx...");
  const receipt = await execute(
    "AdapterRegistry",
    { from: deployer },
    "setAdapterAddress",
    adapterId,
    newAdapterAddress
  );
  console.log("Executed in tx with hash", receipt.transactionHash);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
