const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function pathForLocale(settings, locale) {
	return settings['plugin.inlang.messageFormat'].pathPattern.replace('{locale}', locale);
}

function patternFromMessage(message) {
	const pattern = [];
	const variables = new Set();
	const regex = /\{([A-Za-z_$][\w$]*)\}/g;
	let index = 0;
	let match;

	while ((match = regex.exec(message)) !== null) {
		if (match.index > index) {
			pattern.push({ type: 'text', value: message.slice(index, match.index) });
		}
		variables.add(match[1]);
		pattern.push({
			type: 'expression',
			arg: { type: 'variable-reference', name: match[1] }
		});
		index = match.index + match[0].length;
	}

	if (index < message.length) {
		pattern.push({ type: 'text', value: message.slice(index) });
	}

	return {
		pattern,
		declarations: [...variables].map((name) => ({ type: 'input-variable', name }))
	};
}

export default {
	key: 'plugin.inlang.messageFormat',
	toBeImportedFiles: async ({ settings }) =>
		settings.locales.map((locale) => ({
			path: pathForLocale(settings, locale),
			locale
		})),
	importFiles: async ({ files }) => {
		const byBundle = new Map();
		const messages = [];
		const variants = [];

		for (const file of files) {
			const json = JSON.parse(textDecoder.decode(file.content));
			for (const [bundleId, rawMessage] of Object.entries(json)) {
				if (bundleId === '$schema' || typeof rawMessage !== 'string') continue;

				const { pattern, declarations } = patternFromMessage(rawMessage);
				if (!byBundle.has(bundleId)) {
					byBundle.set(bundleId, { id: bundleId, declarations });
				}
				messages.push({ bundleId, locale: file.locale, selectors: [] });
				variants.push({
					messageBundleId: bundleId,
					messageLocale: file.locale,
					matches: [],
					pattern
				});
			}
		}

		return {
			bundles: [...byBundle.values()],
			messages,
			variants
		};
	},
	exportFiles: async ({ bundles, messages, variants, settings }) => {
		const files = [];
		for (const locale of settings.locales) {
			const entries = {
				$schema: 'https://inlang.com/schema/inlang-message-format'
			};
			for (const bundle of bundles) {
				const message = messages.find((item) => item.bundleId === bundle.id && item.locale === locale);
				const variant = variants.find((item) => item.messageId === message?.id);
				if (!variant) continue;
				entries[bundle.id] = variant.pattern
					.map((part) =>
						part.type === 'text'
							? part.value
							: `{${part.arg.type === 'variable-reference' ? part.arg.name : part.arg.value}}`
					)
					.join('');
			}
			files.push({
				locale,
				name: pathForLocale(settings, locale).split('/').pop(),
				content: textEncoder.encode(JSON.stringify(entries, null, '\t'))
			});
		}
		return files;
	}
};
