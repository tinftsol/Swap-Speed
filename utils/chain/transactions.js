const { buildSimpleTransaction, simulateTransaction} = require("@raydium-io/raydium-sdk");
const { MAKE_TX_VERSION, ADD_LOOKUP_TABLE_INFO } = require("../../constants/solana");
const { MAX_SEND_TRANSACTION_RETRIES } = require("../../constants/system");
const { SystemProgram, TransactionMessage, VersionedTransaction, PublicKey, ComputeBudgetProgram, Transaction } = require("@solana/web3.js");
const axios = require('axios');
const base58 = require("bs58");
const {amountFromLamports} = require("./solana");

const sendTx = async ({ payer, transaction, connection }) => {
  console.log('Starting sendTx function');

  // Sign the transaction
  console.log('Signing the transaction');
  transaction.sign([payer]);
  console.log('Transaction signed');

  // Send the transaction
  console.log('Sending the transaction');
  let retries = 0
  let isSucceed = false;

  let transactionHash
  let parsedResult = null;

  while (!isSucceed && retries < MAX_SEND_TRANSACTION_RETRIES) {
    try {
      retries+=1

      transactionHash = await connection.sendTransaction(transaction, {
        skipPreflight: true
      });

      isSucceed = true

      // Confirm the transaction
      const txConfirmation = await confirmTransaction(connection, transactionHash, "confirmed");

      parsedResult = txConfirmation.parsedResult;

    } catch (e) {
      console.log({ e })
      console.log("Failed to send tx");
    }
  }

  if (!isSucceed) {
    throw Error("Can't send tx")
  }

  console.log('Transaction sent with hash:', transactionHash);

  console.log('sendTx function completed');

  return { transactionHash, parsedResult };
}


async function confirmTransaction(c, txSig, commitmentOrConfig) {
  return new Promise(async (resolve, reject) => {
    const timeout = setTimeout(
        () => reject(new Error('30 second timeout: unable to confirm transaction')),
        30000
    );

    console.log("Delay regarding the poll!")

    await new Promise((resolve) => setTimeout(resolve, 300));
    const config = {
      maxSupportedTransactionVersion: 0,
      ...(typeof commitmentOrConfig === 'string'
          ? { commitment: commitmentOrConfig }
          : commitmentOrConfig),
    };

    let tx = await c.getParsedTransaction(txSig, config);
    while (tx === null) {
      await new Promise((resolve) => setTimeout(resolve, 300));
      tx = await c.getParsedTransaction(txSig, config);
      console.log({ txInCicle: tx })
    }
    console.log(JSON.stringify(tx))
    clearTimeout(timeout);
    const parsedResult = parseTransactionAmounts(tx);

    if (parsedResult.amountInLamports === 0 || parsedResult.amountOutLamports === 0) {
      reject(new Error('TX confirmed but failed'))
    }

    console.log({ parsedResult })
    resolve({ tx, parsedResult });
  });
}

function parseTransactionAmounts(tx) {
  let amountOut = 0;
  let amountIn = 0;

  if (tx && tx.meta && tx.meta.innerInstructions && !tx.meta.err) {
    const allTransfers = [];

    tx.meta.innerInstructions.forEach(innerInstruction => {
      innerInstruction.instructions.forEach(instruction => {
        if (instruction.parsed && instruction.parsed.type === 'transfer') {
          const transferInfo = instruction.parsed.info;
          allTransfers.push(transferInfo);
        }
      });
    });

    if (allTransfers.length > 0) {
      const firstTransfer = allTransfers[0];
      const lastTransfer = allTransfers[allTransfers.length - 1];
      console.log({ firstTransfer, lastTransfer })
      amountIn = parseInt(firstTransfer.amount, 10);

      amountOut = parseInt(lastTransfer.amount, 10);
    }
  }

  return {
    amountInLamports: amountIn,
    amountOutLamports: amountOut
  };
}


const buildAndSendVersionedTransaction = async ({ payer, sendAccountPubkey, amount, connection }) => {
  let isSucceed = false;
  let succeedTransactionHash;
  let retries = 0;

  while (!isSucceed && retries < MAX_SEND_TRANSACTION_RETRIES) {
    const latestBlockHash = await connection.getLatestBlockhash();

    const instructions = [
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: sendAccountPubkey,
        lamports: amount,
      }),
    ];
    const messageV0 = new TransactionMessage({
      payerKey: payer.publicKey,
      recentBlockhash: latestBlockHash.blockhash,
      instructions,
    }).compileToV0Message();
  
    const transaction = new VersionedTransaction(messageV0);

    try {

      const { transactionHash, parsedResult } = await sendTx({ connection, payer, transaction, latestBlockHash });
      succeedTransactionHash = transactionHash
      isSucceed = true;
    } catch (err) {
      retries += 1;
    }
  }

  if(!isSucceed) {
    return;
  }

  return succeedTransactionHash;
}

const calculateComputeUnits = async ({ innerSimpleV0Transaction, connection, wallet}) => {
  const latestBlockHash = await connection.getLatestBlockhash();

  const [transaction] = await buildSimpleTransaction({
    connection,
    makeTxVersion: MAKE_TX_VERSION,
    payer: wallet.publicKey,
    innerTransactions: innerSimpleV0Transaction,
    addLookupTableInfo: ADD_LOOKUP_TABLE_INFO,
    recentBlockhash: latestBlockHash.blockhash,
  });

  const simulation = await simulateTransaction(
      connection,
      [transaction],
      false
  );

  return simulation[0].unitsConsumed
}

const buildAndSendSwapTransaction = async ({ innerSimpleV0Transaction, connection, wallet}) => {
  const latestBlockHash = await connection.getLatestBlockhash();

  const [transaction] = await buildSimpleTransaction({
    connection,
    makeTxVersion: MAKE_TX_VERSION,
    payer: wallet.publicKey,
    innerTransactions: innerSimpleV0Transaction,
    addLookupTableInfo: ADD_LOOKUP_TABLE_INFO,
    recentBlockhash: latestBlockHash.blockhash,
  });

  return await sendTx({ payer: wallet, transaction, connection });
}

// Old Version
// const buildAndSendSwapTransaction = async ({ innerSimpleV0Transaction, connection, wallet}) => {
//   let isSucceed = false;
//   let succeedTransactionHash;
//   let retries = 0;
//
//   while (!isSucceed && retries < MAX_SEND_TRANSACTION_RETRIES) {
//     const tipAccount = await getTipAccounts();
//     const latestBlockHash = await connection.getLatestBlockhash();
//
//     try {
//       const instructions = [
//         SystemProgram.transfer({
//           fromPubkey: wallet.publicKey,
//           toPubkey: new PublicKey(tipAccount),
//           lamports: 1000000,
//         }),
//       ];
//
//       const messageV0 = new TransactionMessage({
//         payerKey: wallet.publicKey,
//         recentBlockhash: latestBlockHash.blockhash,
//         instructions,
//       }).compileToV0Message();
//
//       const tipTransaction = new VersionedTransaction(messageV0);
//
//       const [transaction] = await buildSimpleTransaction({
//         connection,
//         makeTxVersion: MAKE_TX_VERSION,
//         payer: wallet.publicKey,
//         innerTransactions: innerSimpleV0Transaction,
//         addLookupTableInfo: ADD_LOOKUP_TABLE_INFO,
//         recentBlockhash: latestBlockHash.blockhash,
//       });
//
//       succeedTransactionHash = await sendSwapTx({ payer: wallet, transaction, connection });
//       isSucceed = true;
//     } catch (err) {
//       retries += 1;
//     }
//   }
//
//   if(!isSucceed) {
//     throw new Error('Max count retries');
//   }
//
//   return succeedTransactionHash;
// }


exports.calculateComputeUnits = calculateComputeUnits;
exports.buildAndSendSwapTransaction = buildAndSendSwapTransaction;
exports.buildAndSendVersionedTransaction = buildAndSendVersionedTransaction;