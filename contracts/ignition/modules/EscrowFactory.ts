import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

// Base Mainnet addresses
const UMA_OOV3_BASE = "0x2aBf1Bd76655de80eDB3086114315Eec75AF500c";
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

// Base Sepolia addresses
const UMA_OOV3_BASE_SEPOLIA = "0x0F7fC5E6482f096380db6158f978167b57388deE";
const USDC_BASE_SEPOLIA = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

const EscrowFactoryModule = buildModule("EscrowFactoryModule", (m) => {
  const oo = m.getParameter("oo", UMA_OOV3_BASE_SEPOLIA);
  const currency = m.getParameter("currency", USDC_BASE_SEPOLIA);

  const factory = m.contract("EscrowFactory", [oo, currency]);

  return { factory };
});

export default EscrowFactoryModule;
