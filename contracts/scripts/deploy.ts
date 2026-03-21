import { ethers } from "hardhat";

async function main() {
  const network = await ethers.provider.getNetwork();
  console.log(`Deploying to network: ${network.name} (chainId: ${network.chainId})`);

  const [deployer] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Balance: ${ethers.formatEther(balance)} ETH`);

  // Pick oracle and currency based on network
  let oo: string, currency: string;
  if (network.chainId === 8453n) {
    // Base Mainnet
    oo = "0x2aBf1Bd76655de80eDB3086114315Eec75AF500c";
    currency = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
  } else {
    // Base Sepolia (default)
    oo = "0x0F7fC5E6482f096380db6158f978167b57388deE";
    currency = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
  }

  console.log(`UMA OOv3: ${oo}`);
  console.log(`USDC: ${currency}`);

  const Factory = await ethers.getContractFactory("EscrowFactory");
  const factory = await Factory.deploy(oo, currency);
  await factory.waitForDeployment();

  const address = await factory.getAddress();
  console.log(`\nEscrowFactory deployed at: ${address}`);
  console.log(`\nSet FACTORY_ADDRESS=${address} in your .env`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
