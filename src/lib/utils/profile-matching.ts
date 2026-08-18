export function profileNameKey(value: string): string {
	return value
		.toLowerCase()
		.replace(/\([^)]*\)/g, '')
		.replace(/[^\p{L}\p{N}]+/gu, ' ')
		.trim();
}

export function profileNames(user: Record<string, unknown>): string[] {
	return [user.name, user.nickname, user.username, user.email]
		.filter((name): name is string => typeof name === 'string' && !!name)
		.flatMap((name) => {
			const clean = name.replace(/\s*\([^)]*\)\s*$/g, '').trim();
			const comma = clean.match(/^([^,]+),\s+(.+)$/);
			return comma ? [name, clean, `${comma[2]} ${comma[1]}`] : [name, clean];
		});
}

export function profileDisplayName(user: Record<string, unknown>): string {
	if (typeof user.name === 'string' && user.name) return user.name;

	const fallback = [user.nickname, user.username, user.email].find(
		(value): value is string => typeof value === 'string' && !!value
	);
	if (!fallback) return 'User';

	const clean = fallback.replace(/\s*\([^)]*\)\s*$/g, '').trim();
	const comma = clean.match(/^([^,]+),\s+(.+)$/);
	return comma ? `${comma[2]} ${comma[1]}` : clean;
}
