export default class Socket {
	availability;
	webSocketObject;
	states = {
		[WebSocket.CONNECTING]: "Connecting",
		[WebSocket.OPEN]: "Open",
		[WebSocket.CLOSING]: "Closing",
		[WebSocket.CLOSED]: "Closed",
	};

	async createWebsocket(...params) {
		let [url, protocols] = params;
		this.webSocketObject = new WebSocket(url, protocols);

		this.setUpListeners();
		return this;
	}

	async checkReadyState() {
		return this.states[this.webSocketObject.readyState] || "Unknown";
	}

	async checkAvailability() {
		return "WebSocket" in window;
	}

	async isOpen() {
		return this.webSocketObject.readyState === WebSocket.OPEN;
	}

	async sendString(string) {
		if (await this.isOpen()) {
			this.webSocketObject.send(string);
		}
	}

	async sendJSONString(obj) {
		console.log("sendJSONString called: ", obj);
		if (await this.isOpen()) {
			console.log("sending: ", obj);
			this.webSocketObject.send(JSON.stringify(obj));
		}
	}

	async sendBlob(blob) {
		if (await this.isOpen()) {
			this.webSocketObject.send(blob);
		}
	}

	async sendArrayBuffer(arrBuff) {
		if (await this.isOpen()) {
			this.webSocketObject.send(arrBuff);
		}
	}

	async setUpListeners() {
		// OPEN
		this.webSocketObject.onopen = (evt) => this.handleOpen(evt);

		// MESSAGE
		this.webSocketObject.onmessage = (evt) => this.handleMessage(evt);

		// ERROR
		this.webSocketObject.onerror = (evt) => this.handleError(evt);

		// CLOSE
		this.webSocketObject.onclose = (evt) => this.handleClose(evt);
	}

	// startPing() {
	// 	this.pingInterval = setInterval(() => {
	// 		this.sendJSONString({ type: "ping" });
	// 	}, 30000);
	// }

	// endPing() {
	// 	clearInterval(this.pingInterval);
	// }

	async handleOpen(evt) {
		console.log("ws conn established");
		// this.startPing();
	}

	async handleMessage(evt) {
		console.log("Message came: ", evt.data);
	}

	async handleError(evt) {
		console.log("Error: ", evt.data);
	}

	async handleClose(evt) {
		// this.endPing();
		this.closeConn();
	}

	async closeConn() {
		if (await this.isBufferedAmountNull()) {
			this.webSocketObject.close();
		} else {
			setTimeout(() => this.closeConn(), 100);
		}
	}

	async isBufferedAmountNull() {
		return this.webSocketObject.bufferedAmount === 0;
	}
}
