import Socket from "../modules/socket.js";

export default async function initWebsocket() {
	const socket = new Socket();
	const isAvailable = await socket.checkAvailability();
	if (!isAvailable) {
		console.warn("websocket is not available in window");
		return;
	}

	await socket.createWebsocket("ws://localhost:8099/ws");
}
