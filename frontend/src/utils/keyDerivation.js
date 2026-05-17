async function decryptPrivateKey(encryptedData, password, sessionToken) {
  console.log('decryptPrivateKey called');
  const parsed = JSON.parse(encryptedData);
  console.log('parsed encrypted data:', { hasIV: !!parsed.iv, hasAuthTag: !!parsed.authTag, hasData: !!parsed.data });

  const iv = hexToBytes(parsed.iv);
  const authTag = hexToBytes(parsed.authTag);
  const encrypted = hexToBytes(parsed.data);

  console.log('hex conversion:', { ivLen: iv.length, authTagLen: authTag.length, encLen: encrypted.length });

  const combinedInput = `${password}${sessionToken}`;
  console.log('combinedInput length:', combinedInput.length);
  const keyData = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(combinedInput));
  console.log('key derived, length:', keyData.byteLength);

  const key = await crypto.subtle.importKey('raw', keyData, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);

  const ciphertextWithTag = new Uint8Array(encrypted.length + authTag.length);
  ciphertextWithTag.set(encrypted, 0);
  ciphertextWithTag.set(authTag, encrypted.length);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv },
    key,
    ciphertextWithTag
  );

  const decoder = new TextDecoder();
  return JSON.parse(decoder.decode(decrypted));
}

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

export async function unlockKeys(encryptedPrivateKey, password, sessionToken) {
  console.log('unlockKeys called:', { hasPassword: !!password, hasSessionToken: !!sessionToken, pwdLen: password?.length, tokLen: sessionToken?.length });

  const unlockResponse = await fetch('http://localhost:3000/api/keys/unlock', {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    }
  });

  if (!unlockResponse.ok) {
    const error = await unlockResponse.json();
    throw new Error(error.error || 'Failed to get unlock token');
  }

  const { expiresAt } = await unlockResponse.json();
  console.log('Unlock response:', { expiresAt, now: Date.now() });

  if (Date.now() > expiresAt) {
    throw new Error('Unlock token expired, please try again');
  }

  try {
    const privateKey = await decryptPrivateKey(encryptedPrivateKey, password, sessionToken);
    console.log('Decryption successful');
    return privateKey;
  } catch (e) {
    console.error('Decryption failed:', e);
    throw new Error('Failed to decrypt private key: ' + e.message);
  }
}