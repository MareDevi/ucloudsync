/**
 * Simple AES-GCM encryption/decryption using Web Crypto API.
 */

export class CryptoHelper {
	private readonly keyPromise: Promise<CryptoKey>;

	constructor(secret: string) {
		this.keyPromise = this.initKey(secret);
	}

	private async initKey(secret: string): Promise<CryptoKey> {
		const enc = new TextEncoder();
		const keyData = enc.encode(secret.padEnd(32, "0").slice(0, 32));
		return crypto.subtle.importKey("raw", keyData, { name: "AES-GCM" }, false, [
			"encrypt",
			"decrypt",
		]);
	}

	async encrypt(plainText: string): Promise<string> {
		const key = await this.keyPromise;
		const iv = crypto.getRandomValues(new Uint8Array(12));
		const enc = new TextEncoder();
		const encrypted = await crypto.subtle.encrypt(
			{ name: "AES-GCM", iv },
			key,
			enc.encode(plainText),
		);

		const combined = new Uint8Array(iv.length + encrypted.byteLength);
		combined.set(iv);
		combined.set(new Uint8Array(encrypted), iv.length);

		return btoa(String.fromCharCode(...combined));
	}

	async decrypt(cipherText: string): Promise<string> {
		const key = await this.keyPromise;
		const combined = new Uint8Array(
			atob(cipherText)
				.split("")
				.map((c) => c.charCodeAt(0)),
		);
		const iv = combined.slice(0, 12);
		const encrypted = combined.slice(12);

		const decrypted = await crypto.subtle.decrypt(
			{ name: "AES-GCM", iv },
			key,
			encrypted,
		);

		return new TextDecoder().decode(decrypted);
	}
}
