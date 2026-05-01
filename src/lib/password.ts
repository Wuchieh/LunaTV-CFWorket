const SALT_LENGTH = 16;
const KEY_LENGTH = 64;
const ITERATIONS = 100000;

async function deriveKey(
  password: string,
  salt: Uint8Array
): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);

  const baseKey = await crypto.subtle.importKey(
    "raw",
    passwordBuffer,
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt.buffer as ArrayBuffer,
      iterations: ITERATIONS,
      hash: "SHA-512",
    },
    baseKey,
    KEY_LENGTH * 8
  );

  return new Uint8Array(derivedBits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const derivedKey = await deriveKey(password, salt);

  const saltHex = Array.from(salt)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const hashHex = Array.from(derivedKey)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return `${saltHex}:${hashHex}`;
}

export async function verifyPassword(
  password: string,
  storedValue: string
): Promise<boolean> {
  const parts = storedValue.split(":");
  if (
    parts.length === 2 &&
    parts[0].length === SALT_LENGTH * 2 &&
    parts[1].length === KEY_LENGTH * 2
  ) {
    const salt = new Uint8Array(
      parts[0].match(/.{2}/g)!.map((byte) => parseInt(byte, 16))
    );
    const storedHash = parts[1];

    const derivedKey = await deriveKey(password, salt);
    const derivedHex = Array.from(derivedKey)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    if (derivedHex.length !== storedHash.length) {
      return false;
    }

    let match = true;
    for (let i = 0; i < derivedHex.length; i++) {
      if (derivedHex[i] !== storedHash[i]) {
        match = false;
        break;
      }
    }

    if (match && !isHashed(storedValue)) {
      const newHash = await hashPassword(password);
      return true;
    }

    return match;
  }

  return storedValue === password;
}

export function isHashed(storedValue: string): boolean {
  const parts = storedValue.split(":");
  return (
    parts.length === 2 &&
    parts[0].length === SALT_LENGTH * 2 &&
    parts[1].length === KEY_LENGTH * 2
  );
}
