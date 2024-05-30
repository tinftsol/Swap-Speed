const {
  LIQUIDITY_STATE_LAYOUT_V4,
  Liquidity,
  jsonInfo2PoolKeys
} = require("@raydium-io/raydium-sdk");
const { 
  PublicKey,
  SystemProgram, ComputeBudgetProgram
} = require("@solana/web3.js");

const  {
  getSimulationComputeUnits
} = require("@solana-developers/helpers")

const {
  MARKET_PROGRAM_ID,
  SOLANA_TOKEN_ADDRESS,
  MAKE_TX_VERSION,
} = require("../constants/solana");

const { formatAmmKeysById } = require("./chain/formatAmmKeysById");
const { buildAndSendSwapTransaction, calculateComputeUnits } = require("./chain/transactions");
const { getSolPrice, amountToLamports } = require("./chain/solana");

const parsePoolInfo = async ({ connection, pool, solPrice }) => {
  const { account, pubkey } = pool;

  try {  
    const poolState = LIQUIDITY_STATE_LAYOUT_V4.decode(account.data);

    const baseTokenAmountPromise = connection.getTokenAccountBalance(
      poolState.baseVault
    );
    const quoteTokenAmountPromise = connection.getTokenAccountBalance(
      poolState.quoteVault
    );

    const [baseTokenAmount, quoteTokenAmount] = await Promise.all([baseTokenAmountPromise, quoteTokenAmountPromise]);
  
    const baseTokenAmountNumber = baseTokenAmount.value.uiAmount;
    const quoteTokenAmountNumber = quoteTokenAmount.value.uiAmount;
  
    const baseAddress = poolState.baseMint.toBase58();
    const quoteAddress = poolState.quoteMint.toBase58();
  
    let solTokenAmountNumber;
    let secondTokenTokenAmountNumber;
    let secondTokenAddress;
  
    if(baseAddress === SOLANA_TOKEN_ADDRESS) {
      solTokenAmountNumber = baseTokenAmountNumber;
      secondTokenTokenAmountNumber = quoteTokenAmountNumber;
      secondTokenAddress = quoteAddress;
    } else if (quoteAddress === SOLANA_TOKEN_ADDRESS) {
      solTokenAmountNumber = quoteTokenAmountNumber;
      secondTokenTokenAmountNumber = baseTokenAmountNumber;
      secondTokenAddress = baseAddress;
    } else {
      return 'It is not sol pool';
    }

    const secondTokenToSolPrice = solTokenAmountNumber / secondTokenTokenAmountNumber;

    const secondTokenUsdcPrice = secondTokenToSolPrice * solPrice;

    const secondTokenUsdcLiquidity = secondTokenTokenAmountNumber * secondTokenUsdcPrice;

    const secondTokenAccountInfo = await connection.getTokenSupply(new PublicKey(secondTokenAddress));
    const secondTokenSupply = secondTokenAccountInfo.value.uiAmountString;
    const secondTokenMarketCap = secondTokenAccountInfo.value.uiAmountString * secondTokenUsdcPrice;
   
    return {
      pubkey,
      secondTokenUsdcPrice,
      secondTokenUsdcLiquidity,
      secondTokenSupply,
      secondTokenMarketCap
    };
  } catch {
    return `Invalid pool address`;
  }
}

const getMarketAccounts = async ({
  connection,
  tokenAddress,
}) => {
  const accountsPromise = connection.getProgramAccounts(MARKET_PROGRAM_ID, {
    commitment: 'processed',
    filters: [
      { dataSize: LIQUIDITY_STATE_LAYOUT_V4.span },
      {
        memcmp: {
          offset: LIQUIDITY_STATE_LAYOUT_V4.offsetOf("baseMint"),
          bytes: SOLANA_TOKEN_ADDRESS,
        },
      },
      {
        memcmp: {
          offset: LIQUIDITY_STATE_LAYOUT_V4.offsetOf("quoteMint"),
          bytes: tokenAddress,
        },
      },
    ],
  });

  const accountsInversedPromise = connection.getProgramAccounts(MARKET_PROGRAM_ID, {
    commitment: 'processed',
    filters: [
      { dataSize: LIQUIDITY_STATE_LAYOUT_V4.span },
      {
        memcmp: {
          offset: LIQUIDITY_STATE_LAYOUT_V4.offsetOf("baseMint"),
          bytes: tokenAddress,
        },
      },
      {
        memcmp: {
          offset: LIQUIDITY_STATE_LAYOUT_V4.offsetOf("quoteMint"),
          bytes: SOLANA_TOKEN_ADDRESS,
        },
      },
    ],
  });
  
  const resolvedAccounts = await Promise.all([accountsPromise, accountsInversedPromise]);
  
  const mergedAccounts = resolvedAccounts.flat();

  return mergedAccounts;
};

const getBestTokenPool = async ({ connection, tokenAddress }) => {
  const marketAccountsPromise = getMarketAccounts({ connection, tokenAddress });
  const solPricePromise = getSolPrice(connection);

  const [marketAccounts, solPrice] = await Promise.all([marketAccountsPromise, solPricePromise]);

  const promises = marketAccounts.map(async (pool) => parsePoolInfo({ connection, pool, solPrice }));

  const resolvedAccounts = await Promise.all(promises);

  resolvedAccounts.sort((a, b) => a.secondTokenUsdcLiquidity < b.secondTokenUsdcLiquidity ? 1 : -1);
  const bestTokenPool = resolvedAccounts[0];

  return bestTokenPool;
}

// THIS PART IS WORKS VERY SLOW!
// CHECK THE GOOD SWAP INSTURCTIONS AND THAT THIS GENERATES,
// IT'S DIFFERENT.

// LOOKS LIKE USING Liquidity.makeSwapInstructionSimple IS NOT A CHOICE!
// SHOULD BE 1-2 SEC SWAPS
// REF TO CONCURRENT FAST TRX: https://solscan.io/tx/5zzBxRQNQmSHwLVD5KnHCN1UAqrrHHF1hhhS7m8FW3BMcasvxg1HEofS6eCPPiK89ANnczcjQQVjoiPsUXpWDKBp
// REF TO SOME MEDIUM ARTICLES: https://teepy.medium.com/raydium-amm-trading-spl-tokens-on-raydium-using-typescript-e34173b776ba
const swapOnlyAmm = async (input) => {
  // -------- pre-action: get pool info --------
  const targetPoolInfo = await formatAmmKeysById({ connection: input.connection, id: input.targetPool })
  const poolKeys = jsonInfo2PoolKeys(targetPoolInfo);

  // -------- step 1: coumpute amount out --------
  const { minAmountOut } = Liquidity.computeAmountOut({
    poolKeys: poolKeys,
    poolInfo: await Liquidity.fetchInfo({ connection: input.connection, poolKeys }),
    amountIn: input.inputTokenAmount,
    currencyOut: input.outputToken,
    slippage: input.slippage,
  })

  // -------- step 2: create instructions by SDK function --------
  const microLamports = amountToLamports(input.gas);

  const units = 100_514

  const { innerTransactions } = await Liquidity.makeSwapInstructionSimple({
    connection: input.connection,
    poolKeys,
    userKeys: {
      tokenAccounts: input.walletTokenAccounts,
      owner: input.wallet.publicKey,
    },
    amountIn: input.inputTokenAmount,
    amountOut: minAmountOut,
    fixedSide: 'in',
    makeTxVersion: MAKE_TX_VERSION,
    computeBudgetConfig: {
      microLamports,
      units
    }
  })

  if(input.commissionAmount && input.commissionWallet && input.commissionAmount > 0) {
    innerTransactions[0].instructions.push(SystemProgram.transfer({
      fromPubkey: input.wallet.publicKey,
      toPubkey: input.commissionWallet,
      lamports: input.commissionAmount,
    }))
  }

  const { transactionHash, parsedResult } = await buildAndSendSwapTransaction({
    innerSimpleV0Transaction: innerTransactions,
    connection: input.connection,
    wallet: input.wallet,
  });

  return { transactionHash, parsedResult };
}

const getAccountInfo = async ({ connection, pubkey, solPrice }) => {
  const key = new PublicKey(pubkey);

  const poolPromise = connection.getAccountInfo(key, 'processed');

  const [pool] = await Promise.all([poolPromise]);

  const data = {
    account: pool,
    pubkey,
  }

  const parsedPoolInfo = await parsePoolInfo({ connection, pool: data, solPrice })

  return parsedPoolInfo;
}

exports.getMarketAccounts = getMarketAccounts;
exports.parsePoolInfo = parsePoolInfo;
exports.getBestTokenPool = getBestTokenPool;
exports.swapOnlyAmm = swapOnlyAmm;
exports.getAccountInfo = getAccountInfo;
