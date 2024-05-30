const {
  LIQUIDITY_STATE_LAYOUT_V4,
} = require("@raydium-io/raydium-sdk");
const { 
  PublicKey,
  Keypair,
 } = require("@solana/web3.js");
const { 
  Metaplex,
} = require("@metaplex-foundation/js");

const { SOL_USDC_POOL_ID } = require("../../constants/solana");
const { generatePrivateKeyFromBytes, generateBytesFromPrivateKey } = require("../keys");
const { getMint } = require("@solana/spl-token");

const getSolBalance = async (connection, walletPublicKey) => {
  try {
      const balance = await connection.getBalance(new PublicKey(walletPublicKey), 'processed');

      return balance / 10 ** 9;
  } catch (error) {
      console.error("Error fetching balance:", error);
      return null;
  }
}

const createWallet = () => {
  const keypair = Keypair.generate();

  const address = keypair.publicKey.toBase58();
  const privateKey = generatePrivateKeyFromBytes(keypair.secretKey);

  return {
    address,
    privateKey,
  }
}

const importWalletByPrivateKey = (privateKey) => {
  const privateKeyBytes = generateBytesFromPrivateKey(privateKey);
  const keypair = Keypair.fromSecretKey(privateKeyBytes);
  const address = keypair.publicKey.toBase58();

  return {
    address,
  }
}

const getTokenBalance = async ({ connection, walletAddress, tokenAddress }) => {
  try {
    const tokenKey = new PublicKey(tokenAddress);

    const tokenAccounts = await connection.getTokenAccountsByOwner(walletAddress, { mint: tokenKey }, 'processed');

    const pubkey = tokenAccounts.value[0]?.pubkey;

    if(!pubkey) return { uiAmount: 0 };

    const balance = await connection.getTokenAccountBalance(pubkey, 'processed');
    
    return balance.value;
  } catch (error) {
    console.error("Error fetching balance:", error);
    return null;
  }
}

const getTokenInfo = async ({ connection, tokenAddress }) => {
  try {
    const tokenKey = new PublicKey(tokenAddress);
    const metaplex = Metaplex.make(connection)
  
    const tokenInfo = await metaplex.nfts().findByMint({ mintAddress: tokenKey });

    return tokenInfo;
  } catch (error) {
    console.error("Error fetching balance:", error);
    return null;
  }
}

const getTokenDecimals = async ({ connection, tokenAddress }) => {
  const mintPublicKey = new PublicKey(tokenAddress);

  const mintInfo = await getMint(connection, mintPublicKey);

  return mintInfo.decimals;
}
  
const getSolPrice = async (connection) => {
  const info = await connection.getAccountInfo(new PublicKey(SOL_USDC_POOL_ID));

  if (!info) return;

  const poolState = LIQUIDITY_STATE_LAYOUT_V4.decode(info.data);
  
  const baseTokenAmount = await connection.getTokenAccountBalance(
    poolState.baseVault
  );
  const quoteTokenAmount = await connection.getTokenAccountBalance(
    poolState.quoteVault
  );

  const baseTokenAmountNumber = baseTokenAmount.value.uiAmount;
  const quoteTokenAmountNumber = quoteTokenAmount.value.uiAmount;

  const solPrice = quoteTokenAmountNumber / baseTokenAmountNumber;

  return solPrice.toFixed(2)
}

const amountToLamports = (amount, decimals = 9) => {
  return (amount * (10 ** decimals)).toFixed();
}

const amountFromLamports = (lamports, decimals = 9) => {
  return lamports / (10 ** decimals);
}

exports.getSolPrice = getSolPrice;
exports.getSolBalance = getSolBalance;
exports.amountToLamports = amountToLamports;
exports.getTokenBalance = getTokenBalance;
exports.getTokenInfo = getTokenInfo;
exports.createWallet = createWallet;
exports.importWalletByPrivateKey = importWalletByPrivateKey;
exports.amountFromLamports = amountFromLamports;
exports.getTokenDecimals = getTokenDecimals;