window.addEventListener("DOMContentLoaded", function () {
	console.log("JavaScript loaded");

	/**
	 * Els
	 */
	const generateButton = document.querySelector("#codeGenerator");
	const connectButton = document.querySelector("#codeInputer");
	const sendFileButton = document.querySelector("#sendFileButton");
	const fileInput = document.querySelector("#fileInput");
	const generatedCodeField = document.querySelector("#generatedCode");
	const inputedCodeField = document.querySelector("#inputedCode");
	const receivedContainer = document.querySelector("#received");
	const fileInputContainer = document.querySelector("#fileInputContainer");

	/**
	 * Other vars
	 */

	let peer = new Peer();
	let conn = {};
	let incomingFileInfo = null;
	let incomingFileData = null;
	let receivedSize = 0;
	let receiveBuffer = [];

	peer.on("open", function (id) {
		console.log("My ID is:", id);
		generatedCodeField.value = id;
	});

	peer.on("connection", function (conn) {
		handleConn(conn);
	});

	/**
	 * Listeners
	 */
	connectButton.addEventListener("click", connect);
	sendFileButton.addEventListener("click", sendFile);

	function connect(evt) {
		console.log("Connecting...");
		const code = inputedCodeField.value;
		console.log("To peer with code: ", code);
		conn = peer.connect(code);
		conn.on("open", function () {
			showDataExchangeDOM();
			conn.on("data", function (data) {
				handleReceivedData(data);
			});
		});
	}

	/**
	 * Global peer events
	 */

	function sendFile() {
		console.log("sendFile called");

		// Check if we have an open connection
		if (!conn || conn.dataChannel.readyState !== "open") {
			console.error("No open connection available");
			return;
		}

		// Get the file from the file input
		const fileInput = document.querySelector("#fileInput");
		const file = fileInput.files[0];

		if (!file) {
			console.log("No file selected");
			return;
		}

		console.log(
			`Sending file: ${file.name} (${file.type}, ${file.size} bytes)`,
		);

		// First, send file metadata
		conn.send({
			dataType: "FILE_META",
			fileName: file.name,
			fileType: file.type,
			fileSize: file.size,
		});

		// Then send the file in chunks
		const chunkSize = 16384; // 16KB chunks
		let offset = 0;

		const reader = new FileReader();

		reader.onload = function (event) {
			// Send this chunk
			conn.send({
				dataType: "FILE_CHUNK",
				chunk: new Uint8Array(event.target.result),
				offset: offset,
			});

			offset += event.target.result.byteLength;

			// Calculate and display progress
			const progress = Math.min(100, Math.round((offset / file.size) * 100));
			console.log(`Sending progress: ${progress}%`);

			// If there's more to send, read the next chunk
			if (offset < file.size) {
				readSlice(offset);
			} else {
				// All chunks sent, send completion message
				conn.send({
					dataType: "FILE_COMPLETE",
				});
				console.log("File sent completely");
			}
		};

		reader.onerror = function (error) {
			console.error("Error reading file:", error);
		};

		function readSlice(o) {
			const slice = file.slice(o, o + chunkSize);
			reader.readAsArrayBuffer(slice);
		}

		// Start reading the first slice
		readSlice(0);
	}

	function formatBytes(bytes, decimals = 2) {
		if (bytes === 0) return "0 Bytes";

		const k = 1024;
		const dm = decimals < 0 ? 0 : decimals;
		const sizes = ["Bytes", "KB", "MB", "GB", "TB"];

		const i = Math.floor(Math.log(bytes) / Math.log(k));

		return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
	}

	function handleConn(c) {
		conn = c;
		conn.on("open", function () {
			showDataExchangeDOM();
			conn.on("data", function (data) {
				handleReceivedData(data);
			});

			conn.send("Hello!");
		});
	}

	function showDataExchangeDOM() {
		fileInputContainer.style.visibility = "visible";
		sendFileButton.removeAttribute("disabled");
	}

	function handleReceivedData(data) {
		console.log("data received: ", data);
		console.log("Received data type:", data.dataType);

		if (data.dataType === "FILE_META") {
			// New file transfer starting
			console.log(
				`Receiving file: ${data.fileName} (${data.fileType}, ${data.fileSize} bytes)`,
			);

			// Reset our file reception variables
			incomingFileInfo = {
				name: data.fileName,
				type: data.fileType,
				size: data.fileSize,
			};
			receiveBuffer = [];
			receivedSize = 0;

			// Update UI to show we're receiving a file
			updateReceiveProgress(0);
		} else if (data.dataType === "FILE_CHUNK") {
			// Ensure we're expecting a file
			if (!incomingFileInfo) {
				console.error("Received file chunk but no file metadata");
				return;
			}

			// Add this chunk to our buffer
			receiveBuffer.push(data.chunk);
			receivedSize += data.chunk.byteLength;

			// Update progress
			const percentComplete = Math.min(
				100,
				Math.round((receivedSize / incomingFileInfo.size) * 100),
			);
			updateReceiveProgress(percentComplete);
		} else if (data.dataType === "FILE_COMPLETE") {
			// Make sure we have file info
			if (!incomingFileInfo) {
				console.error("Received file complete but no file metadata");
				return;
			}

			// Check if we got all the data
			if (receivedSize === incomingFileInfo.size) {
				// Create a blob from all chunks
				const fileBlob = new Blob(receiveBuffer, {
					type: incomingFileInfo.type,
				});

				// Create download container
				createDownloadLink(
					fileBlob,
					incomingFileInfo.name,
					incomingFileInfo.type,
					receivedSize,
				);

				// Reset for next file
				incomingFileInfo = null;
				receiveBuffer = [];
				receivedSize = 0;

				console.log("File received completely");
			} else {
				console.warn(
					`File size mismatch. Expected: ${incomingFileInfo.size}, Got: ${receivedSize}`,
				);
			}
		} else if (data.dataType === "FILE") {
			// Handle single-chunk files (your original format)
			const fileBlob = new Blob([data.file], { type: data.fileType });
			createDownloadLink(
				fileBlob,
				data.fileName,
				data.fileType,
				data.file.length,
			);
		}
	}

	function updateReceiveProgress(percent) {
		console.log(`Receive progress: ${percent}%`);

		// Update UI with progress
		const progressElement =
			document.getElementById("receiveProgress") || createProgressElement();
		progressElement.value = percent;
		progressElement.textContent = `${percent}%`;
	}

	// Create a progress element if needed
	function createProgressElement() {
		const progressElement = document.createElement("progress");
		progressElement.id = "receiveProgress";
		progressElement.max = 100;

		const progressLabel = document.createElement("span");
		progressLabel.textContent = "Receiving file: 0%";

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
		fileInfo.textContent = `${fileType} - ${formatBytes(fileSize)}`;

		const iconElement = document.createElement("span");
		iconElement.className = "file-icon";

		if (fileType.startsWith("image/")) {
			iconElement.textContent = "🖼️";

			if (fileSize < 5000000) {
				const preview = document.createElement("img");
				preview.src = URL.createObjectURL(fileBlob);
				preview.className = "file-preview";
				preview.alt = fileName;
				downloadContainer.appendChild(preview);
			}
		} else if (fileType.startsWith("audio/")) {
			iconElement.textContent = "🔊";
		} else if (fileType.startsWith("video/")) {
			iconElement.textContent = "🎬";
		} else if (fileType === "application/pdf") {
			iconElement.textContent = "📄";
		} else {
			iconElement.textContent = "📁";
		}

		const deleteButton = document.createElement("button");
		deleteButton.textContent = "🗑️";
		deleteButton.className = "delete-button";
		deleteButton.onclick = function () {
			downloadContainer.remove();
			URL.revokeObjectURL(downloadLink.href);  
		};

		downloadContainer.appendChild(iconElement);
		downloadContainer.appendChild(downloadLink);
		downloadContainer.appendChild(fileInfo);
		downloadContainer.appendChild(deleteButton);

		const progressElement = document.getElementById("receiveProgress");
		if (progressElement && progressElement.parentNode) {
			progressElement.parentNode.remove();
		}

		receivedContainer.appendChild(downloadContainer);
	}
});
