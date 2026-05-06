const { generateKeyPair, encrypt } = require('./crypto/merkle-hellman');
const { attackOnBlocks, attack } = require('./crypto/attack');

const keys = generateKeyPair(8);
const message = "HELLO";
const ciphertext = encrypt(message, keys.publicKey);

let successCount = 0;
for (let i=0; i<ciphertext.length; i++) {
  const result = attack(keys.publicKey, ciphertext[i]);
  console.log(`Block ${i}:`, result.success);
  if (result.success) successCount++;
}
console.log("Success count:", successCount);
