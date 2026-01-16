const hre = require("hardhat");

const ORIGIN_VAULT_ADDRESS = process.env.VAULT_ADDRESS;
const DEST_CSETH_ADDRESS = process.env.CSETH_ADDRESS;
const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY;

async function main() {
  if (!ORIGIN_VAULT_ADDRESS || !DEST_CSETH_ADDRESS || !RELAYER_PRIVATE_KEY) {
    console.error("Missing environment variables");
    console.error("Required: VAULT_ADDRESS, CSETH_ADDRESS, RELAYER_PRIVATE_KEY");
    process.exit(1);
  }

  const relayer = new hre.ethers.Wallet(
    RELAYER_PRIVATE_KEY,
    hre.ethers.provider
  );

  console.log("Relayer address:", relayer.address);
  console.log("Watching for events...\n");

  const vault = await hre.ethers.getContractAt(
    "CBridgeVault",
    ORIGIN_VAULT_ADDRESS,
    relayer
  );

  const cseth = await hre.ethers.getContractAt(
    "cSETH",
    DEST_CSETH_ADDRESS,
    relayer
  );

  vault.on("Locked", async (user, amount, event) => {
    console.log(`[Locked Event] User: ${user}, Amount: ${amount}`);
    
    try {
      const tx = await cseth.mint(user, amount);
      await tx.wait();
      console.log(`[Minted] ${amount} cSETH to ${user}`);
      
      const confirmTx = await vault.confirmMint(user, amount);
      await confirmTx.wait();
      console.log(`[Confirmed] Mint for ${user}\n`);
    } catch (error) {
      console.error(`[Error] Failed to mint:`, error.message);
    }
  });

  cseth.on("Burned", async (user, amount, event) => {
    console.log(`[Burned Event] User: ${user}, Amount: ${amount}`);
    
    try {
      const confirmTx = await vault.confirmBurn(user, amount);
      await confirmTx.wait();
      console.log(`[Confirmed] Burn for ${user}`);
      
      const tx = await vault.unlock(user, amount);
      await tx.wait();
      console.log(`[Unlocked] ${amount} sETH to ${user}\n`);
    } catch (error) {
      console.error(`[Error] Failed to unlock:`, error.message);
    }
  });

  await new Promise(() => {});
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });