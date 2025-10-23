import type { Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { paraglideMiddleware } from '$lib/paraglide/server';

const handleParaglide: Handle = ({ event, resolve }) =>
	paraglideMiddleware(event.request, ({ request, locale }) => {
		event.request = request;

		return resolve(event, {
			transformPageChunk: ({ html }) => html.replace('%paraglide.lang%', locale)
		});
	});

const handleAuth: Handle = async ({ event, resolve }) => {
	// Get auth cookie from request
	const authCookie = event.cookies.get('pb_auth');

	// Make auth state available to load functions
	event.locals.pb_auth = authCookie;

	const response = await resolve(event);

	return response;
};

export const handle: Handle = sequence(handleAuth, handleParaglide);
