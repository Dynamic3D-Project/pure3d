declare const __APP_VERSION__: string;
declare const __BUILD_DATE__: string;

declare global {
	namespace App {
		interface Locals {
			pb_auth?: string;
		}
	}

	interface Window {
		dataLayer?: unknown[];
		gtag?: (...args: unknown[]) => void;
	}
}

export {};
