const { TOKEN_PROGRAM_ID, SPL_ACCOUNT_LAYOUT } = require("@raydium-io/raydium-sdk");

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
exports.getWalletTokenAccount = getWalletTokenAccount;
