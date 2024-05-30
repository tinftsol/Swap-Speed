const bs58 = require("bs58");

const generatePrivateKeyFromBytes = (privateKeyBytes) => {
  return bs58.encode(privateKeyBytes);
};

const generateBytesFromPrivateKey = (privateKey) => {
  return bs58.decode(privateKey);
};

exports.generatePrivateKeyFromBytes = generatePrivateKeyFromBytes;
exports.generateBytesFromPrivateKey = generateBytesFromPrivateKey;
