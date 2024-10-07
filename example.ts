const banner = Bun.file('./assets/wgwbanner.jpg');
const avatar = Bun.file('./assets/wgwphoto.jpg');

// mfpurr
const dataUri = `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAYAAACM/rhtAAAEfElEQVR4nNWYW2gcVRjHf5vsxrZgE8gobMRcNtmztqYVDaTdJm1tUOxDwXeVEHwohYIGFH3xAo0vCkXNUylYgkj6UsHH1jwEgk1soIIxpN3JJm02NoFki62U5tJ014fNmZ6ZPXPZTQT9w8DM+c7M+Z3v+86cS0gIkec/rAp5Uz9cv6UPlfv+7u64pz30v/Fg9rd9W/pQue/7ed4CNF75o8hY01YXuCHd+9uhCi/jvesL/0qjpcgT0C+BF+ZmratcZY5lPO2egH9/P+1qW5ibpb0jSXtHMhCIW2cC56BObi9LOICDB18KBBZLCG1ndB5Ucz/s+XWXBmMJ4QsnPRVLCAyjtqQ21NwPA/wSzlkFnRtPnDr4+m1bF6RN16AzdE4w2Znxq2O+gLu741Z6hVU4J6wOws17slxqNmUym4L2jqRvGjil5r5nDuqk8957H5xiNmViGLXW1d6RJJYQjF8do//sOQD6z56jriHm24aa+6GlvS35Zz6+bxUsf1lt3avllT3LvHrscKn9sfT7r6OsPQ4FBpSDJ6xCOKGknj75F6379pYNB/BcS4KZVLrk9wKF+MGaPrSlyDBqaU60YJqlQRbG6JFQ4WnEsbA5EuKp5mX279/j+6HpNy5ry+NXjttsz78NK5v3O797OQCghFNBHQrqvcxHuwBo2Myz/OnJQDZvwBLl5qntqg/22SUM8FnjKgBnbu+wVZTlTsWvHA8M4gxxENlGsQrhBuQHt90q8uBWlc3eBaD+q4eFAiW/BgYu0HFRbwuiMMC33xT+fe/3VtuMhXL/P5Fh1GI4PDswcAGAZ/vOIyeupU9PAhCLvUgs1hgMUMKpoKoqcwUPuY1k6T3VLuHctLGxoS2vaasrWsX7uifydY6bkzdc7XLu1cGN9PVyiSkALjHFSF+vZ1u6LUYFwIf9hcsptVx6Sqds9m6RXYWRoZXlQrRov6PbYoTONOUD7Yu/mKvghdY9vj9tZ3jr6xMAZDIpTpx4k4mJm66AOgVebn3SUAi1lycBenretT1nMikymRSAL5xui2GdLLzzKFVk/CGSsE3u1VURVjbWAXy9qXqyHM8VAbrJufqQjSzNT/NwTQ+qennuxhT3H4EQ9hW3TuoMogXUVQBIp9PklJ2AhKxpq2P84ggAVRV51nNP+trVddiCnZiY8oVzU6CZJOeyTbl3fcEWNnPGZOjyEK2trUSjUVvdxcVFhjuPAtBkGAA0/vQj0WjU6kzZgELYF5qmmUaIFtvuCyBSEWH51GnOr64wNFQAlRruPMr06uZKMJsF4MHk5Oaj+8ALfPxmmmmqQpWs5x9b0Pp6JmMHDnErm7WA4jt20mQY/PznPJ/fmQ/SnB7QLQdVSFWv3ekqqi8BS5FXqG0h9jvIcUpXXwhB8tqoK+StzfCq8gp1YA/Kidztt6PKNE0Gm4U1GJxKXhvVlutU8hFwEMBCPW9IKICq/0edgwJPdfLEyQnkto0UQtA9M60NqdTYgUOYpmk966IXGNDttHVXxB0yJuK8NWN6Qg42CxukU/8AWx77px35tY8AAAAASUVORK5CYII=`;

async function optimizeUsingFormDataFiles() {
	const formdata = new FormData();
	formdata.append('files', banner);
	formdata.append('files', avatar);
	const resp = await fetch(`http://localhost:3000/webp`, {
		method: 'POST',
		body: formdata,
	});
	const json = await resp.json();
	console.log(json.result);
}

async function optimizeUsingDataURIs() {
	const resp = await fetch(`http://localhost:3000/webp`, {
		method: 'POST',
		// optionally pass array of dataURI strings
		body: JSON.stringify({ files: dataUri }),
		headers: { 'content-type': 'application/json' },
	});

	const json = await resp.json();
	const u8str = json.result.files[0].output;

	// here's how to conveert the stringified Uint8Array from the response
	const u8arr = Uint8Array.from(JSON.parse(u8str));

	console.log(json.result.files);

	await Bun.write('./assets/mfpurr.webp', u8arr);
}
