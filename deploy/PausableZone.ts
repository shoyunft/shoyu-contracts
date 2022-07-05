import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const NONCE = "555555555555551";

const deployFunction: DeployFunction = async function ({
  ethers,
  deployments,
  getNamedAccounts,
  getChainId,
}: HardhatRuntimeEnvironment) {
  console.log("Running PausableZone deploy script");

  const { save, deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  const zoneController = await deploy("PausableZoneController", {
    from: deployer,
    args: [deployer],
    log: true,
  });

  try {
    const pausableZone = await ethers.getContract("PausableZone");
    console.log('reusing "PausableZone" at address', pausableZone.address);
  } catch (e) {
    const salt = `${deployer}${
      NONCE.length < 24 ? String(NONCE).padStart(24, "0") : NONCE.slice(0, 24)
    }`;

    const pausableZoneController = await ethers.getContract(
      "PausableZoneController"
    );

    const tx = await pausableZoneController.createZone(salt);
    const receipt = await tx.wait();

    const pausableZoneAddress = pausableZoneController.interface.decodeEventLog(
      "ZoneCreated",
      receipt.events[1].data,
      receipt.events[1].topics
    ).zone;

    const artifact = await deployments.getExtendedArtifact("PausableZone");
    await save("PausableZone", { address: pausableZoneAddress, ...artifact });

    console.log("PausableZone deployed at address", pausableZoneAddress);
  }
};

export default deployFunction;

deployFunction.tags = ["DeployPausableZone"];
