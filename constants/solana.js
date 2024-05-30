const { MAINNET_PROGRAM_ID, LOOKUP_TABLE_CACHE, TxVersion } = require("@raydium-io/raydium-sdk");

const SOLANA_TOKEN_ADDRESS = "So11111111111111111111111111111111111111112";
const SOL_USDC_POOL_ID = "58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2";

const MARKET_PROGRAM_ID = MAINNET_PROGRAM_ID.AmmV4;

const MAKE_TX_VERSION = TxVersion.V0;
const ADD_LOOKUP_TABLE_INFO = LOOKUP_TABLE_CACHE;

const SOL_SCAN_TX_LINK = 'https://solscan.io/tx';
const SOL_SCAN_TOKEN_LINK = 'https://solscan.io/token';
const BIRDEYE_TOKEN_LINK = 'https://birdeye.so/token';
const BIRDEYE_LINK = 'https://birdeye.so/token';
const DEXTOOLS_TOKEN_LINK = 'https://www.dextools.io/app/en/solana/pair-explorer';
const DEXTOOLS_LINK = 'https://www.dextools.io/app/en/solana';
const DEXSCREENER_TOKEN_LINK = 'https://dexscreener.com/solana';
const DEXSCREENER_LINK = 'https://dexscreener.com/solana';

exports.MARKET_PROGRAM_ID = MARKET_PROGRAM_ID;
exports.SOLANA_TOKEN_ADDRESS = SOLANA_TOKEN_ADDRESS;
exports.SOL_USDC_POOL_ID = SOL_USDC_POOL_ID;
exports.MAKE_TX_VERSION = MAKE_TX_VERSION;
exports.ADD_LOOKUP_TABLE_INFO = ADD_LOOKUP_TABLE_INFO;
exports.SOL_SCAN_TX_LINK = SOL_SCAN_TX_LINK;
exports.SOL_SCAN_TOKEN_LINK = SOL_SCAN_TOKEN_LINK;
exports.BIRDEYE_TOKEN_LINK = BIRDEYE_TOKEN_LINK;
exports.BIRDEYE_LINK = BIRDEYE_LINK;
exports.DEXTOOLS_LINK = DEXTOOLS_LINK;
exports.DEXTOOLS_TOKEN_LINK = DEXTOOLS_TOKEN_LINK;
exports.DEXSCREENER_TOKEN_LINK = DEXSCREENER_TOKEN_LINK;
exports.DEXSCREENER_LINK = DEXSCREENER_LINK;
