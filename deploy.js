const hre = require("hardhat");

async function main() {
  const [deployer, relayer] = await hre.ethers.getSigners();

  console.log("Deploying contracts with:", deployer.address);
  console.log("Relayer address:", relayer.address);

  const MockStaking = await hre.ethers.getContractFactory("MockStaking");
  const mockStaking = await MockStaking.deploy();
  await mockStaking.waitForDeployment();
  console.log("MockStaking deployed to:", await mockStaking.getAddress());

  const CBridgeVault = await hre.ethers.getContractFactory("CBridgeVault");
  const vault = await CBridgeVault.deploy(
    await mockStaking.getAddress(),
    relayer.address
  );
  await vault.waitForDeployment();
  console.log("CBridgeVault deployed to:", await vault.getAddress());

  const cSETH = await hre.ethers.getContractFactory("cSETH");
  const cseth = await cSETH.deploy(relayer.address);
  await cseth.waitForDeployment();
  console.log("cSETH deployed to:", await cseth.getAddress());

  console.log("\nDeployment Summary:");
  console.log("-------------------");
  console.log("Origin Chain:");
  console.log("  MockStaking:", await mockStaking.getAddress());
  console.log("  CBridgeVault:", await vault.getAddress());
  console.log("\nDestination Chain:");
  console.log("  cSETH:", await cseth.getAddress());
  console.log("\nRelayer:", relayer.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });