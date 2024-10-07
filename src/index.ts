import { rm as remove } from 'node:fs/promises';
import { toWebHandler } from 'h3';
import { createIPX, createIPXH3App, ipxFSStorage, ipxHttpStorage } from 'ipx';
import imageminWebp from 'imagemin-webp';

const ipx = createIPX({
	storage: ipxFSStorage({ dir: './assets' }),
	httpStorage: ipxHttpStorage({ allowAllDomains: true, maxAge: 60 * 60 * 24 }),
});

// export const app = createApp().use('/optimize', createIPXH3Handler(ipx));
export const app = createIPXH3App(ipx);
const webHandler = toWebHandler(app);

Bun.serve({
	async fetch(req: Request) {
		const url = new URL(req.url);

		if (url.pathname === '/') {
			return new Response(null, {
				status: 301,
				headers: { location: `https://github.com/unjs/ipx` },
			});
		}

		const [modifiers, ...data] = url.pathname.slice(1).split('/');
		const dataURI = data.join('/');

		if (modifiers !== 'basic') {
			return ipxOptimizeHandler(req, modifiers, dataURI);
		}

		return imageminWebpHandler(req, dataURI);
	},
});

async function imageminWebpHandler(req: Request, dataURI: string) {
	const ifNoneMatch = req.headers.get('if-none-match');

	if (ifNoneMatch) {
		const digest = await createDigest(dataURI);
		const etag = `"${digest.slice(0, 30)}"`;

		if (etag === ifNoneMatch) {
			return new Response(new TextEncoder().encode(dataURI), {
				status: 304,
				headers: { 'content-type': 'image/webp', 'cache-control': 'public, max-age=3600, s-maxage=3600, immutable', etag },
			});
		}
	}

	const url = new URL(req.url);
	const options = [...url.searchParams.entries()].reduce((acc: any, [k, v]) => ({ ...acc, [k]: v }), {});
	try {
		const toWebp = imageminWebp(options);
		const buf = await fetch(dataURI).then((res) => res.arrayBuffer());

		// imagemin is oldschool and kinda abandonded, expecting and returns strictly Buffers,
		// so we converting ArrayBuffer to Uint8Array to Buffer
		const optimized = await toWebp(Buffer.from(new Uint8Array(buf)));
		const digest = await createDigest(dataURI);
		const etag = `"${digest.slice(0, 30)}"`;

		return new Response(new Uint8Array(optimized), {
			headers: { 'content-type': 'image/webp', 'cache-control': 'public, max-age=3600, s-maxage=3600, immutable', etag },
		});
	} catch (err: any) {
		return new Response(`Server failure: ${err.message}`, { status: 500 });
	}
}

async function ipxOptimizeHandler(req: Request, modifiers: string, data: string) {
	const url = new URL(req.url);
	// const [modifiers, data] = url.pathname.slice(1).split('/');

	if (data.includes('data:')) {
		if (!data.includes('data:image')) {
			return new Response('Invalid data URI input, only images supported', { status: 500 });
		}

		const buf = await fetch(data).then((res) => res.arrayBuffer());
		const digest = await createDigest(new Uint8Array(buf));

		await Bun.write(`./assets/${digest}`, buf);

		const clonedReq = new Request(`${url.origin}/${modifiers}/${digest}`, req);
		const resp = await webHandler(clonedReq);

		remove(`./assets/${digest}`);

		return resp;
	}

	return webHandler(req);
}

async function createDigest(msg: string | Uint8Array, algo: 'SHA-1' | 'SHA-256' | 'SHA-512' = 'SHA-256') {
	const data = typeof msg === 'string' ? new TextEncoder().encode(msg) : msg;
	const hashBuffer = await crypto.subtle.digest(algo, data);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
	return hashHex;
}
