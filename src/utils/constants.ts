import polygonVaultAbi from '@/assets/abi/PolygonVault.json';
import polygonRegistryAbi from '@/assets/abi/PolygonVaultRegistry.json';
import avaxVaultAbi from '@/assets/abi/AvaxVault.json';
import avaxRegistryAbi from '@/assets/abi/AvaxVaultRegistry.json';

export enum Network {
  ETHEREUM = 0,
  GOERLI = 5,
  OPTIMISM = 10,
  BINANCE_SMART_CHAIN = 56,
  BSC = 97,
  POLYGON = 137,
  FANTOM_OPERA = 250,
  MEGA = 6342,
  ARBITRUM = 42151,
  AVALANCHE = 43114,
  AMOY = 80002
}

export const NETWORKS = {
  1: {
    id: 'ethereum',
    symbol: 'ETH',
    name: 'Ethereum',
    icon: './img/icons/ethereum-eth-logo.png'
  },
  5: {
    id: 'ethereum',
    symbol: 'ETH',
    name: 'Goerli Testnet',
    icon: './img/icons/ethereum-eth-logo.png'
  },
  10: {
    id: 'optimistic-ethereum',
    symbol: 'OP',
    name: 'Optimism',
    icon: './img/icons/optimism-ethereum-op-logo.png'
  },
  56: {
    id: 'binancecoin',
    symbol: 'BNB',
    name: 'Binance Smart Chain',
    icon: './img/icons/binance-coin-bnb-logo.png'
  },
  97: {
    id: 'binancecoin',
    symbol: 'BNB',
    name: 'BSC Testnet',
    icon: './img/icons/binance-coin-bnb-logo.png'
  },
  137: {
    id: 'polygon',
    symbol: 'POL',
    name: 'Polygon',
    icon: './img/icons/polygon-matic-logo.png'
  },
  250: {
    id: 'fantom',
    symbol: 'FTM',
    name: 'Fantom Opera',
    icon: './img/icons/fantom-ftm-logo.png'
  },
  6342: {
    id: 'mega',
    symbol: 'MEGA',
    name: 'Mega Testnet',
    icon: './img/icons/bitcoin-btc-logo.png'
  },
  42151: {
    id: 'arbitrum',
    symbol: 'ARB',
    name: 'Arbitrum One',
    icon: './img/icons/arbitrum-arb-logo.png'
  },
  43114: {
    id: 'avalanche-2',
    symbol: 'AVAX',
    name: 'Avalanche (C-Chain)',
    icon: './img/icons/avalanche-avax-logo.png'
  },
  59141: {
    id: 'linea',
    symbol: 'ETH',
    name: 'Linea Testnet',
    icon: './img/icons/ethereum-eth-logo.png'
  },
  59144: {
    id: 'linea',
    symbol: 'ETH',
    name: 'Linea Mainnet',
    icon: './img/icons/ethereum-eth-logo.png'
  },
  80001: {
    id: 'polygon',
    symbol: 'POL',
    name: 'Polygon Mumbai',
    icon: './img/icons/polygon-matic-logo.png'
  },
  80002: {
    id: 'polygon',
    symbol: 'POL',
    name: 'Amoy Testnet',
    icon: './img/icons/polygon-matic-logo.png'
  },
  84532: {
    id: 'base',
    symbol: 'ETH',
    name: 'Base Sepolia',
    icon: './img/icons/base-eth-logo.png'
  },
  11155111: {
    id: 'ethereum',
    symbol: 'SepoliaETH',
    name: 'Sepolia Testnet',
    icon: './img/icons/ethereum-eth-logo.png'
  }
};

export const polygonMainnet = {
  chainId: '0x89', // 137 in hex
  chainName: 'Polygon Mainnet',
  nativeCurrency: {
    name: 'POL',
    symbol: 'POL',
    decimals: 18
  },
  rpcUrls: ['https://polygon-rpc.com'],
  blockExplorerUrls: ['https://polygonscan.com']
};

export const avalancheMainnet = {
  chainId: '0xa86a', // 43114 in hex
  chainName: 'Avalanche C-Chain',
  nativeCurrency: {
    name: 'Avalanche C-Chain',
    symbol: 'AVAX',
    decimals: 18
  },
  rpcUrls: [
    'https://api.avax.network/ext/bc/C/rpc',
    'https://avalanche-mainnet.infura.io'
  ],
  blockExplorerUrls: ['https://snowtrace.io']
};

export const POLYGON_CONTRACT_ADDRESS_STAGING =
  '0x574383E627bA8ac7442d1f5a8369830c9e64A00';
//issuer 1: 0x8619dDE66AbeDf8818690F79feF00Bb433FDEA7f
//issuer 2 and 3: 0x574383E627bA8ac7442d1f5a8369830c9e64A00

export const POLYGON_CONTRACT_ADDRESS_PRODUCTION =
  '0x9ac93245367975b06013C1EE0204A5E42e91b57B';
//issuer 1: 0x68eA8A05D52CFe66031383FEA4e3256cFE9ff5Ce
//issuer 2 and 3: 0x9ac93245367975b06013C1EE0204A5E42e91b57B
export const POLYGON_CONTRACT_ADDRESS_PRODUCTION_ISSUER_1 =
  '0x68eA8A05D52CFe66031383FEA4e3256cFE9ff5Ce';

export const AVAX_CONTRACT_ADDRESS_STAGING =
  '0x410e7c2c6d717445215734D3d7c9CC0c6D043B8d';
//issuer 3: 0x410e7c2c6d717445215734D3d7c9CC0c6D043B8d

export const AVAX_CONTRACT_ADDRESS_PRODUCTION =
  '0x28058649E3e3103763de83549B84ACb4B6d9dBC8';
//issuer 3: 0x133B0823C58A4cd91470d1545cd65b7063Df4FDB

export const CHAINS = [
  {
    //Polygon
    id: 137,
    hexId: polygonMainnet.chainId,
    contracts: [
      POLYGON_CONTRACT_ADDRESS_PRODUCTION,
      POLYGON_CONTRACT_ADDRESS_PRODUCTION_ISSUER_1
    ],
    name: 'Polygon',
    gas: 'https://gasstation.polygon.technology/v2',
    vaultAbi: polygonVaultAbi,
    registryAbi: polygonRegistryAbi,
    balanceCall: 'getProtocolTokenBalances',
    reservationCall: 'getWithdrawProtocolTokenReservation',
    reservationLockCall: 'getProtocolTokenWithdrawalReservationLockDuration',
    rpcs: [
      {
        name: 'Tenderly',
        url: 'https://polygon.gateway.tenderly.co'
      },
      {
        name: 'Polygon RPC',
        url: 'https://polygon-rpc.com'
      }
    ],
    currencies: [
      {
        name: 'USDT0',
        value: '0xc2132d05d31c914a87c6611c10748aeb04b58e8f'
      },
      {
        name: 'USDC',
        value: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359'
      },
      {
        name: 'XAUT0',
        value: '0xf1815bd50389c46847f0bda824ec8da914045d14'
      }
    ]
  },
  {
    /*Avalanche*/
    id: 43114,
    hexId: avalancheMainnet.chainId,
    contracts: [AVAX_CONTRACT_ADDRESS_PRODUCTION],
    name: 'Avalanche (C-Chain)',
    gas: 'https://cdn.routescan.io/api/evm/43114/gas-price?',
    vaultAbi: avaxVaultAbi,
    registryAbi: avaxRegistryAbi,
    balanceCall: 'getPaymentTokenBalances',
    reservationCall: 'getWithdrawPaymentTokenReservation',
    reservationLockCall: 'getPaymentTokenWithdrawalReservationLockDuration',
    rpcs: [
      {
        name: 'Tenderly v1',
        url: 'https://avalanche-mainnet.gateway.tenderly.co'
      },
      {
        name: 'Tenderly v2',
        url: 'https://avalanche.gateway.tenderly.co'
      },
      {
        name: 'DRPC',
        url: 'https://avalanche.drpc.org'
      },
      {
        name: '1rpc',
        url: 'https://1rpc.io/avax/c'
      },
      {
        name: 'Avax Network',
        url: 'https://api.avax.network/ext/bc/C/rpc'
      }
    ],
    currencies: [
      {
        name: 'USDT',
        value: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7'
      },
      {
        name: 'USDC',
        value: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E'
      },
      {
        name: 'XAUT0',
        value: '0x2775d5105276781B4b85bA6eA6a6653bEeD1dd32'
      }
    ]
  }
];

export const POLYGON_USDT_ADDRESS_STAGING =
  '0x5DC14a664d551F24e9f7A4C9c6215a84E44f0f1E';

export const TODAY_TIME =
  (Date.now() - new Date().setHours(0, 0, 0, 0)) / 36e5 / 24;

export const THIS_YEAR_DAYS = Math.floor(
  (new Date().getTime() - new Date(new Date().getFullYear(), 0, 1).getTime()) /
    (1000 * 60 * 60 * 24)
);
