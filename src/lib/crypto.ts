async function getKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);

  const baseKey = await crypto.subtle.importKey(
    "raw",
    passwordBuffer,
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt.buffer as ArrayBuffer,
      iterations: 100000,
      hash: "SHA-512",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export class SimpleCrypto {
  static async encrypt(data: string, password: string): Promise<string> {
    try {
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const key = await getKey(password, salt);

      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(data);

      const encrypted = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv },
        key,
        dataBuffer
      );

      const combined = new Uint8Array(
        salt.length + iv.length + encrypted.byteLength
      );
      combined.set(salt, 0);
      combined.set(iv, salt.length);
      combined.set(new Uint8Array(encrypted), salt.length + iv.length);

      return btoa(String.fromCharCode(...combined));
    } catch {
      throw new Error("加密失败");
    }
  }

  static async decrypt(
    encryptedData: string,
    password: string
  ): Promise<string> {
    try {
      const combined = Uint8Array.from(atob(encryptedData), (c) =>
        c.charCodeAt(0)
      );

      const salt = combined.slice(0, 16);
      const iv = combined.slice(16, 28);
      const data = combined.slice(28);

      const key = await getKey(password, salt);

      const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: iv },
        key,
        data
      );

      const decoder = new TextDecoder();
      const decoded = decoder.decode(decrypted);

      if (!decoded) {
        throw new Error("解密失败，请检查密码是否正确");
      }

      return decoded;
    } catch {
      throw new Error("解密失败，请检查密码是否正确");
    }
  }

  static async canDecrypt(
    encryptedData: string,
    password: string
  ): Promise<boolean> {
    try {
      await this.decrypt(encryptedData, password);
      return true;
    } catch {
      return false;
    }
  }
}
