import dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(import.meta.dirname, '../../../.env') });

function required(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required env var: ${name}`);
  return val;
}

function optional(name: string, fallback: string): string {
  return process.env[name] || fallback;
}

export const config = {
  blockchain: {
    deployerPrivateKey: required('DEPLOYER_PRIVATE_KEY') as `0x${string}`,
    counterpartyPrivateKey: required('COUNTERPARTY_PRIVATE_KEY') as `0x${string}`,
    baseRpcUrl: optional('BASE_RPC_URL', 'https://mainnet.base.org'),
    baseSepoliaRpcUrl: optional('BASE_SEPOLIA_RPC_URL', 'https://sepolia.base.org'),
    factoryAddress: optional('FACTORY_ADDRESS', '') as `0x${string}`,
  },
  contracts: {
    umaOOv3Base: '0x2aBf1Bd76655de80eDB3086114315Eec75AF500c' as `0x${string}`,
    umaOOv3BaseSepolia: '0x0F7fC5E6482f096380db6158f978167b57388deE' as `0x${string}`,
    usdcBase: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as `0x${string}`,
    usdcBaseSepolia: '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as `0x${string}`,
  },
} as const;
