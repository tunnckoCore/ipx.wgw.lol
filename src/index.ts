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

		if (/(?:basic|c?webp|multiple)/gi.test(modifiers)) {
			if (req.method === 'POST') {
				return imageminWebpPostHandler(req);
			}

			return imageminWebpGetHandler(req, dataURI);
		}

		return ipxOptimizeHandler(req, modifiers, dataURI);
	},
});

async function imageminWebpPostHandler(req: Request) {
	try {
		let files;

		if (req.headers.get('content-type') === 'application/json') {
			const resp = await req.json();
			const incomingFiles = Array.isArray(resp.files) ? resp.files : [resp.files];
			files = await Promise.all(
				incomingFiles
					.filter((x: string) => typeof x === 'string')
					.map(async (fileURI: string) => {
						const resp = await fetch(fileURI);
						const bufUint8 = new Uint8Array(await resp.arrayBuffer());
						const type = resp.headers.get('content-type') || 'image/png';
						const digestAsName = await createDigest(bufUint8);

						const file = new File([bufUint8], digestAsName.slice(0, 10), { type });
						// @ts-ignore bruh, yeah
						file.digest = digestAsName;
						return file;
					}),
			);
		} else if (req.headers.get('content-type')?.includes('multipart/form-data')) {
			const formData = await req.formData();
			files = formData.getAll('files') as File[] | Blob[];
		}

		if (!files || (files && files.length === 0)) {
			return Response.json({ error: { message: 'No files provided', httpStatus: 400 } }, { status: 400 });
		}

		const toWebp = imageminWebp({});

		const results = await Promise.all(
			files
				.filter((x: File | Blob) => x.type.includes('image'))
				.map(async (file: File | Blob) => {
					const buf = await file.arrayBuffer();
					const optimized = await toWebp(Buffer.from(new Uint8Array(buf)));

					// @ts-ignore bruh, yeah
					const hash = file.digest || (await createDigest(optimized));

					return { hash, output: String('[' + new Uint8Array(optimized) + ']'), type: 'image/webp', name: file.name };
				}),
		);

		const digest = await createDigest(JSON.stringify(results.map((x) => x.hash)));

		return Response.json({ result: { digest, files: results } });
	} catch (err: any) {
		return Response.json({ error: { message: `Failure: ${err.message}`, httpStatus: 500 } }, { status: 500 });
	}
}

async function imageminWebpGetHandler(req: Request, dataURI: string) {
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
