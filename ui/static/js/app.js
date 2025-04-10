import Socket from "./modules/socket.js";

window.addEventListener("DOMContentLoaded", async function () {
	/**
	 * DOM Els
	 */
	const connectButton = document.querySelector("#codeInputer");
	const sendFileButton = document.querySelector("#sendFileButton");
	const fileInput = document.querySelector("#fileInput");
	const generatedCodeField = document.querySelector("#generatedCode");
	const inputedCodeField = document.querySelector("#inputedCode");
	const receivedContainer = document.querySelector("#received");
	const fileInputContainer = document.querySelector("#fileInputContainer");

	const socket = new Socket();
	if (!(await socket.checkAvailability())) {
		console.warn("websocket is not available in window");
		return;
	}
	const protocol = window.location.protocol;
	const host = window.location.host;
	const prefix = protocol == "http:" ? "ws:" : "wss:";
	const localId =
		Date.now().toString() + Math.floor(Math.random() * 1000).toString();
	await socket.createWebsocket(`${prefix}//${host}/ws?id=${localId}`);

	let remoteId = "";
	generatedCodeField.value = localId;

	const peerConnection = new RTCPeerConnection();
	let dataChannel = null;

	peerConnection.onicecandidate = (e) => {
		if (e.candidate) {
			socket.sendJSONString({
				to: remoteId,
				from: localId,
				type: "iceCandidate",
				data: e.candidate,
			});
		}
	};

	peerConnection.ondatachannel = (event) => {
		dataChannel = event.channel;
		dataChannel.onopen = () => console.log("Data channel open");
		dataChannel.onmessage = (evt) => {
			let msg = JSON.parse(evt.data);
			handleReceivedData(msg);
		};
	};

	socket.webSocketObject.onmessage = (evt) => {
		const message = JSON.parse(evt.data);
		if (message.from === localId) return;
		switch (message.type) {
			case "offer":
				remoteId = message.from;
				peerConnection
					.setRemoteDescription(message.data)
					.then(() => peerConnection.createAnswer())
					.then((answer) => peerConnection.setLocalDescription(answer))
					.then(() =>
						socket.sendJSONString({
							to: remoteId,
							from: localId,
							type: "answer",
							data: peerConnection.localDescription,
						}),
					)
					.catch(console.error);
				break;
			case "answer":
				peerConnection.setRemoteDescription(message.data).catch(console.error);
				break;
			case "iceCandidate":
				peerConnection.addIceCandidate(message.data).catch(console.error);
				break;
			default:
				handleReceivedData(message);
				break;
		}
	};

	connectButton.addEventListener("click", () => {
		remoteId = inputedCodeField.value.trim();
		dataChannel = peerConnection.createDataChannel("fileExchange");
		dataChannel.onopen = () => console.log("Data channel open");
		dataChannel.onmessage = (evt) => {
			let msg = JSON.parse(evt.data);
			handleReceivedData(msg);
		};
		peerConnection
			.createOffer()
			.then((offer) => peerConnection.setLocalDescription(offer))
			.then(() =>
				socket.sendJSONString({
					to: remoteId,
					from: localId,
					type: "offer",
					data: peerConnection.localDescription,
				}),
			)
			.catch(console.error);
		showDataExchangeDOM();
	});

	sendFileButton.addEventListener("click", sendFile);
	function sendFile() {
		console.log("sendFile called");
		if (!dataChannel || dataChannel.readyState !== "open") {
			console.error("No open connection available");
			return;
		}

		const file = fileInput.files[0];

		if (!file) {
			console.log("No file selected");
			return;
		}

		console.log(
			`Sending file: ${file.name} (${file.type}, ${file.size} bytes)`,
		);
		dataChannel.send(
			JSON.stringify({
				dataType: "FILE_META",
				fileName: file.name,
				fileType: file.type,
				fileSize: file.size,
			}),
		);

		const chunkSize = 16384;  
		let offset = 0;
		const reader = new FileReader();

		reader.onload = function (event) {
			if (dataChannel.bufferedAmount < chunkSize) {
				setTimeout(() => {
					const arr = Array.from(new Uint8Array(event.target.result));
					dataChannel.send(
						JSON.stringify({
							dataType: "FILE_CHUNK",
							chunk: arr,
							offset: offset,
						}),
					);
					offset += event.target.result.byteLength;
					const progress = Math.min(
						100,
						Math.round((offset / file.size) * 100),
					);
					console.log(`Sending progress: ${progress}%`);
					if (offset < file.size) {
						readSlice(offset);
					} else {
						dataChannel.send(JSON.stringify({ dataType: "FILE_COMPLETE" }));
						console.log("File sent completely");
					}
				}, 300);  
			} else {
				const arr = Array.from(new Uint8Array(event.target.result));
				dataChannel.send(
					JSON.stringify({
						dataType: "FILE_CHUNK",
						chunk: arr,
						offset: offset,
					}),
				);
				offset += event.target.result.byteLength;
				const progress = Math.min(100, Math.round((offset / file.size) * 100));
				console.log(`Sending progress: ${progress}%`);
				if (offset < file.size) {
					readSlice(offset);
				} else {
					dataChannel.send(JSON.stringify({ dataType: "FILE_COMPLETE" }));
					console.log("File sent completely");
				}
			}
		};

		reader.onerror = (error) => console.error("Error reading file:", error);

		function readSlice(o) {
			const slice = file.slice(o, o + chunkSize);
			reader.readAsArrayBuffer(slice);
		}

		readSlice(0);
	}

	let incomingFileInfo = null,
		receiveBuffer = [],
		receivedSize = 0;
	function handleReceivedData(data) {
		console.log("Received data:", data);
		if (data.dataType === "FILE_META") {
			console.log(
				`Receiving file: ${data.fileName} (${data.fileType}, ${data.fileSize} bytes)`,
			);
			incomingFileInfo = {
				name: data.fileName,
				type: data.fileType,
				size: data.fileSize,
			};
			receiveBuffer = [];
			receivedSize = 0;
			updateReceiveProgress(0);
		} else if (data.dataType === "FILE_CHUNK") {
			if (!incomingFileInfo) {
				console.error("Received file chunk but no metadata");
				return;
			}
			const chunk = new Uint8Array(data.chunk);
			receiveBuffer.push(chunk);
			receivedSize += chunk.byteLength;
			const percentComplete = Math.min(
				100,
				Math.round((receivedSize / incomingFileInfo.size) * 100),
			);
			updateReceiveProgress(percentComplete);
		} else if (data.dataType === "FILE_COMPLETE") {
			if (!incomingFileInfo) {
				console.error("Received file complete but no metadata");
				return;
			}
			if (receivedSize === incomingFileInfo.size) {
				const fileBlob = new Blob(receiveBuffer, {
					type: incomingFileInfo.type,
				});
				createDownloadLink(
					fileBlob,
					incomingFileInfo.name,
					incomingFileInfo.type,
					receivedSize,
				);
				incomingFileInfo = null;
				receiveBuffer = [];
				receivedSize = 0;
				console.log("File received completely");
			} else {
				console.warn(
					`File size mismatch. Expected: ${incomingFileInfo.size}, Got: ${receivedSize}`,
				);
			}
		}
	}

	function updateReceiveProgress(percent) {
		console.log(`Receive progress: ${percent}%`);
		const progressElement =
			document.getElementById("receiveProgress") || createProgressElement();
		progressElement.value = percent;
		progressElement.textContent = `${percent}%`;
	}

	function createProgressElement() {
		const progressElement = document.createElement("progress");
		progressElement.id = "receiveProgress";
		progressElement.max = 100;
		const progressLabel = document.createElement("span");
		progressLabel.textContent = "Receiving file:";
		const container = document.createElement("div");
		container.className = "progress-container";
		container.appendChild(progressLabel);
		container.appendChild(progressElement);
		receivedContainer.appendChild(container);
		return progressElement;
	}

	function createDownloadLink(fileBlob, fileName, fileType, fileSize) {
		const downloadContainer = document.createElement("div");
		downloadContainer.className = "download-item";
		const downloadLink = document.createElement("a");
		downloadLink.href = URL.createObjectURL(fileBlob);
		downloadLink.download = fileName;
		downloadLink.textContent = `Download: ${fileName}`;
		downloadLink.className = "download-link";
		const fileInfo = document.createElement("div");
		fileInfo.className = "file-info";
		fileInfo.textContent = `${fileType} - ${fileSize} bytes`;
		const deleteButton = document.createElement("button");
		deleteButton.textContent = "🗑️";
		deleteButton.className = "delete-button";
		deleteButton.onclick = function () {
			downloadContainer.remove();
			URL.revokeObjectURL(downloadLink.href);
		};
		downloadContainer.append(downloadLink, fileInfo, deleteButton);
		const progressElement = document.getElementById("receiveProgress");
		if (progressElement && progressElement.parentNode) {
			progressElement.parentNode.remove();
		}
		receivedContainer.appendChild(downloadContainer);
	}

	function showDataExchangeDOM() {
		fileInputContainer.style.visibility = "visible";
		sendFileButton.removeAttribute("disabled");
	}
});
