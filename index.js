const {Keypair, PublicKey, SystemProgram, Connection} = require("@solana/web3.js");
const {Token, Percent, TokenAmount, jsonInfo2PoolKeys, Liquidity} = require("@raydium-io/raydium-sdk");
const {SOLANA_TOKEN_ADDRESS, MAKE_TX_VERSION} = require("./constants/solana");

const bs58 = require("bs58");
const { TOKEN_PROGRAM_ID, SPL_ACCOUNT_LAYOUT } = require("@raydium-io/raydium-sdk");
const {formatAmmKeysById} = require("./utils/chain/formatAmmKeysById");
const {buildAndSendSwapTransaction} = require("./utils/chain/transactions");
const {getMint} = require("@solana/spl-token");
const { swapOnlyAmm } = require("./utils/raydium");

const performBuy = async ({tokenAddress, pubkey, tokenAmountToBuy}) => {
    const connection = new Connection("https://mainnet.helius-rpc.com/?api-key=9439d8c0-2ae3-4bde-94f7-1592388e17c8", "processed");

    const slippagePercent = 5
    const gas = 0.0005

    const wallet = Keypair.fromSecretKey(generateBytesFromPrivateKey(""));

    const walletTokenAccountsPromise = getWalletTokenAccount(connection, wallet.publicKey);
    const tokenDecimalsPromise = getTokenDecimals({connection, tokenAddress});
    const [
        walletTokenAccounts,
        tokenDecimals
    ] = await Promise.all([walletTokenAccountsPromise, tokenDecimalsPromise]);

    const outputToken = new Token(TOKEN_PROGRAM_ID, new PublicKey(tokenAddress), 6);
    const targetPool = pubkey;
    const slippage = new Percent(slippagePercent, 100);
    const inputToken = new Token(TOKEN_PROGRAM_ID, new PublicKey(SOLANA_TOKEN_ADDRESS), 6);
    const overallAmount = amountToLamports(tokenAmountToBuy);
    const commissionAmount = overallAmount * 0.001;
    const swapAmount = overallAmount - commissionAmount;
    const inputTokenAmount = new TokenAmount(inputToken, swapAmount);
    const commissionWallet = new PublicKey("COMISSION_WALLET");

    const {transactionHash, parsedResult} = await swapOnlyAmm({
        outputToken,
        targetPool,
        inputTokenAmount,
        slippage,
        walletTokenAccounts,
        wallet,
        connection,
        gas,
        commissionAmount,
        commissionWallet,
    })

    console.log("TRX: " + transactionHash)
}
const getWalletTokenAccount = async (connection, wallet) => {
    const walletTokenAccount = await connection.getTokenAccountsByOwner(wallet, {
        programId: TOKEN_PROGRAM_ID,
    });

    return walletTokenAccount.value.map((i) => ({
        pubkey: i.pubkey,
        programId: i.account.owner,
        accountInfo: SPL_ACCOUNT_LAYOUT.decode(i.account.data),
    }));
}

const getTokenByTokenAddress = async ({ tokenAddress }) => {
    return await Token.findOne({tokenAddress});
};

const amountToLamports = (amount, decimals = 9) => {
    return (amount * (10 ** decimals)).toFixed();
}

const amountFromLamports = (lamports, decimals = 9) => {
    return lamports / (10 ** decimals);
}

const generatePrivateKeyFromBytes = (privateKeyBytes) => {
    return bs58.encode(privateKeyBytes);
};

const getTokenDecimals = async ({ connection, tokenAddress }) => {
    const mintPublicKey = new PublicKey(tokenAddress);

    const mintInfo = await getMint(connection, mintPublicKey);

    return mintInfo.decimals;
}

const generateBytesFromPrivateKey = (privateKey) => {
    return bs58.decode(privateKey);
};

const main = async () => {
   console.log("HEY");

   const tokenAddress = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
   const pubkey = '58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2';
   const tokenAmountToBuy = 0.001

   await performBuy(
       {
           tokenAddress,
           pubkey,
           tokenAmountToBuy,
       }
   )
};

main().catch((error) => {
  console.error('Error in main:', error);
});