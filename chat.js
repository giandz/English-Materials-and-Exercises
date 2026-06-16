////////////////////////////////////////////////////
///////////////// Video Chat ///////////////////////
////////////////////////////////////////////////////
if (!window.location.search && !the_class) {
	the_class = {"language":"en"};
}
var chatTimestamp = new Date();
var chatButtons = document.querySelector("#chat").querySelectorAll("button");
var chatInputs = document.querySelector("#chat").querySelectorAll("[contenteditable]");
var buttonCaptions = [
	{ //🎲
		"en": "Random icon",
		"es": "Ícono aleatorio",
		"pt": "Ícone aleatório",
		"it": "Icona casuale",
		"fr": "Icône aléatoire",
		"de": "Zufälliges Symbol",
	},
	{ //🎨
		"en": "Random color",
		"es": "Color aleatorio",
		"pt": "Cor aleatória",
		"it": "Colore casuale",
		"fr": "Couleur aléatoire",
		"de": "Zufällige Farbe",
	},
	{ //📛
		"en": "Connect to the server",
		"es": "Conectar al servidor",
		"pt": "Conectar ao servidor",
		"it": "Connettare al server",
		"fr": "Connecter au serveur",
		"de": "Verbinden zum Server",
	},
	{ //📞
		"en": "Join the room",
		"es": "Unirse a la sala",
		"pt": "Entre na sala",
		"it": "Entrare nella stanza",
		"fr": "Rejoindre la salle",
		"de": "Raum betreten",
	},
	{ //🎤
		"en": "Mute the microphone",
		"es": "Silenciar el micrófono",
		"pt": "Silenciar o microfone",
		"it": "Disattivare il microfono",
		"fr": "Couper le micro",
		"de": "Mikrofon stumm schalten",
	},
	{ //🎥
		"en": "Mute the camera",
		"es": "Silenciar la cámara",
		"pt": "Silenciar a câmera",
		"it": "Disattivare la webcam",
		"fr": "Couper la caméra",
		"de": "Schalten die Kamera aus",
	},
	{ //❌
		"en": "Leave the room",
		"es": "Dejar la sala",
		"pt": "Deixar a sala",
		"it": "Lasciare la stanza",
		"fr": "Quitter la salle",
		"de": "Verlassen den Raum",
	},
	{ //💾
		"en": "Save chat log",
		"es": "Guardar registro del chat",
		"pt": "Salvar log do chat",
		"it": "Salvare registro chat",
		"fr": "Enregistrer journal du chat",
		"de": "Chat-Protokoll speichern",
	},
	// { //📎
	// 	"en": "Attach a file",
	// 	"es": "Adjuntar un archivo",
	// 	"pt": "Enviar um arquivo",
	// 	"it": "Inviare un file",
	// 	"fr": "Envoyer un fichier",
	// 	"de": "Eine Datei senden",
	// },
	{ //✈️
		"en": "Send text",
		"es": "Enviar texto",
		"pt": "Mandar mensagem",
		"it": "Inviare testo",
		"fr": "Envoyer du texte",
		"de": "Text senden",
	}
];
var inputCaptions = [
	{
		"en": "Username",
		"es": "Nombre de usuario",
		"pt": "Username",
		"it": "Nome utente",
		"fr": "Nom d'utilisateur",
		"de": "Nutzername",
	},
	{
		"en": "Room name",
		"es": "Nombre de sala",
		"pt": "Nome da sala",
		"it": "Nome della stanza",
		"fr": "Nom de la salle",
		"de": "Raumname",
	},
	{
		"en": "Type a message...",
		"es": "Escribe un mensaje...",
		"pt": "Digite uma mensagem...",
		"it": "Scrivi un messaggio...",
		"fr": "Tapez un message...",
		"de": "Nachricht eingeben...",
	}
];

for (b = 0; b < chatButtons.length; b++) {
	chatButtons[b].setAttribute("title", buttonCaptions[b][the_class.language]);
};
for (i = 0; i < chatInputs.length; i++) {
	chatInputs[i].setAttribute("title", inputCaptions[i][the_class.language]);
	chatInputs[i].setAttribute("placeholder", inputCaptions[i][the_class.language]);
};

var idRegex = new RegExp("[\\bA-Za-z0-9_-]");
var urlRegex = new RegExp("^(http[s]?:\\/\\/(www\\.)?|ftp:\\/\\/(www\\.)?|(www\\.)?){1}([0-9A-Za-z-\\.@:%_\+~#=]+)+((\\.[a-zA-Z]{2,3})+)(/(.)*)?(\\?(.)*)?");
var welcomeMsg = {
	"en": "Welcome",
	"es": "Bienvenido",
	"pt": "Ben-vindo",
	"it": "Benvenuto",
	"fr": "Bienvenu",
	"de": "Willkommen",
};
var joinMsg = {
	"en": "joined",
	"es": "se ha unido",
	"pt": "juntou-se",
	"it": "si unì",
	"fr": "a rejoint",
	"de": "ist beigetreten",
};
var leaveMsg = {
	"en": "left",
	"es": "se ha ido",
	"pt": "se foi",
	"it": "partì",
	"fr": "est parti",
	"de": "verließ",
};
var farewellMsg = {
	"en": "See you later",
	"es": "Hasta luego",
	"pt": "Até logo",
	"it": "Arrivederci",
	"fr": "À toute à l'heure",
	"de": "Bis später",
};
var guestString = {
	"en": "Guest",
	"es": "Invitado",
	"pt": "Convidado",
	"it": "Ospite",
	"fr": "Invite",
	"de": "Gast",
};
var handlemojis = ["🦘", "🦡", "🐒", "🐔", "🐧", "🐦", "🐤", "🐣", "🐥", "🦆", "🦢", "🦅", "🦉", "🦚", "🦜",
	"🦇", "🐴", "🦄", "🐝", "🐛", "🦋", "🐌", "🐚", "🐞", "🐜", "🦗", "🕷", "🦂", "🦟", "🦠", "🐢", "🐍", "🦎",
	"🦖", "🦕", "🐙", "🦑", "🦐", "🦀", "🐡", "🐠", "🐟", "🐬", "🐳", "🐋", "🦈", "🐊", "🐅", "🐆", "🦓", "🦍",
	"🐘", "🦏", "🦛", "🐪", "🐫", "🦙", "🐃", "🐂", "🐄", "🐎", "🐖", "🐏", "🐑", "🐐", "🦌", "🐕", "🐩", "🐈",
	"🐓", "🦃", "🕊", "🐇", "🐁", "🐀", "🐿", "🦔", "🐉", "🐲"
];

function randomIcon() {
	document.querySelector("#my-icon").innerHTML = handlemojis[Math.floor((Math.random() * handlemojis.length))];
};

function randomColor() {
	var rr = (Math.floor(Math.random() * 127) + 127);
	var gg = (Math.floor(Math.random() * 127) + 127);
	var bb = (Math.floor(Math.random() * 127) + 127);
	document.querySelector("#my-name").style.color = "rgb(" + rr + ", " + gg + ", " + bb + ")";
	document.querySelector("#my-name").setAttribute("rgbcolor", rr.toString() + gg.toString() + bb.toString());
}

document.querySelector('#my-name').addEventListener('keydown', function (e) {
  var value = e.key;
  if (!idRegex.test(value)) {
  	e.stopPropagation();
  	e.preventDefault();
  }
});
document.querySelector('#my-name').addEventListener('input', function (e) {
  var value = e.key;
  if (!idRegex.test(value)) {
  	e.stopPropagation();
  	e.preventDefault();
  }
});

document.querySelector('#my-name').addEventListener('paste', function (e) {
  	e.stopPropagation();
  	e.preventDefault();
});

document.querySelector('#my-name').addEventListener('keypress', function (e) {
  var length = document.querySelector('#my-name').innerText.length;
  if (length > 35) {
  	e.stopPropagation();
  	e.preventDefault();
  }
});

document.querySelector('#my-name').addEventListener('keypress', function (e) {
	if(e.key === 'Enter') {
		e.preventDefault();
		setupChat();
	}
});

document.querySelector('#send-text').addEventListener('keypress', function (e) {
	if(e.key === 'Enter') {
		e.preventDefault();
	}
});

randomIcon();
randomColor();

var chatLog = {"log":[], "hash": ""};

async function setupChat() {
	var localVideo = document.querySelector("#my-face");
	var myName = document.querySelector("#my-name");
	var setupButton = document.querySelector("#setup-chat");
	var localText = document.querySelector("#send-text");
	var remoteVideos = document.querySelector("#their-faces")
	var joinButton = document.querySelector("#join-btn");
	var sendButton = document.querySelector("#send-btn");
	var saveChatButton = document.querySelector("#save-chat-btn");
	// var fileButton = document.querySelector("#send-file-btn");
	var leaveButton = document.querySelector("#hangup-btn");
	var roomId = document.querySelector("#room-name");
	var messages = document.querySelector("#chat-text");
	var muteMike = document.querySelector("#mute-mike-btn");
	var muteCam = document.querySelector("#mute-cam-btn");

	myName.setAttribute("contenteditable", false);
	setupButton.disabled = true;
	document.querySelector("#random-icon-btn").disabled = true;
	document.querySelector("#random-color-btn").disabled = true;
	setupButton.style = "filter: saturate(0)";
	document.querySelector("#random-icon-btn").style = "filter: saturate(0)";
	document.querySelector("#random-color-btn").style = "filter: saturate(0)";
	var devices = await navigator.mediaDevices.enumerateDevices();
	var optionsObject = {}
	if (devices.find(function (dv) {return dv.kind.includes("videoinput")})) {
		optionsObject = {video:true, audio: true};
	} else if (devices.find(function (dv) {return dv.kind.includes("audioinput")})) {
		optionsObject = {video:false, audio: true};
	} else {
		alert("No audio devices detected.");
	}
	const localStream = await navigator.mediaDevices.getUserMedia(optionsObject).catch(console.error);
	
	localVideo.muted = true;
	localVideo.srcObject = localStream;
	localVideo.playsInline = true;

	await localVideo.play().catch(console.error);
	
	if (myName.innerText != "") {
		var userNameString = myName.innerText;
	} else {
		var userNameString = guestString[the_class.language] + (Math.floor(Math.random() * 9000) + 999);
		myName.innerText = userNameString;
	};

	var idString = encodeURIComponent(myName.parentElement.innerText.split("\n")[2]).replace(/%/g, "-") +
		document.querySelector("#my-name").getAttribute("rgbcolor") + userNameString;
		console.log(idString)
	
	const peer = (window.peer = new Peer(idString, {
		key: atob(decodeURIComponent(atob("TWpGbE1UUmlOamN0TXpJNFpDMDBOV1ZsTFdFMllUVXRNRGhoTURWak5qazRZekkz"))),
		debug: 3,
	}));

	setTimeout(function(){document.querySelector("#my-name").classList.add("right");document.querySelector("#join-btn").disabled = false; document.querySelector("#join-btn").style = ""}, 1000);

	

	document.querySelector("#room-name").addEventListener('keypress', function (e) {
		if(e.key === 'Enter') {
			e.preventDefault();
		}
	});
	muteMike.addEventListener('click', () => {
		if(muteMike.getAttribute("muted") == "false") {
			
			localStream.getAudioTracks()[0].enabled = false;
			
			muteMike.setAttribute("muted", "true");
		} else if(muteMike.getAttribute("muted") == "true") {
			
			localStream.getAudioTracks()[0].enabled = true;
		
			muteMike.setAttribute("muted", "false");

		};
	});
	muteCam.addEventListener('click', () => {
		if(muteCam.getAttribute("muted") == "false") {
			
			localStream.getVideoTracks()[0].enabled = false;
			
			muteCam.setAttribute("muted", "true");
		} else if(muteCam.getAttribute("muted") == "true") {
			
			localStream.getVideoTracks()[0].enabled = true;
		
			muteCam.setAttribute("muted", "false");
		};
	});

	joinButton.addEventListener('click', () => {

		if(!peer.open) {
			myName.classList.remove("right");
			myName.classList.add("wrong");
			setupButton.disabled = false;
			setupButton.style = "";
		}
		const room = peer.joinRoom(roomId.innerHTML, {
			mode: "mesh",
			stream: localStream
		});
		room.on('open', async () => {
			chatTimestamp.setTime(Date.now());
			var msgString = "<div class='server-msg'><span title='" + chatTimestamp.toISOString() + "'>" + welcomeMsg[the_class.language] + "</span></div>"
			messages.innerHTML += msgString;

			/*Log*/
			chatLog.log.push({"timestamp": chatTimestamp.toISOString(), "hash": "", "origin": "system", "content": welcomeMsg[the_class.language]});
			chatLog.log[chatLog.log.length - 1].hash = await digestMessage(Object.values(chatLog.log[chatLog.log.length - 1]).join());
			messages.scrollTop = messages.scrollHeight * 2;
		});
		room.on('peerJoin', async peerId => {
			chatTimestamp.setTime(Date.now());
			var msgString = "<div class='server-msg'><span title='" + chatTimestamp.toISOString() + "' style='color: rgba(" +
				peerId.substr(12, 3) + ", " + peerId.substr(15, 3) + ", " + peerId.substr(18, 3) + ", 1)'>" +
				decodeURIComponent(peerId.substr(0,12).replace(/-/g, "%")) + ' ' +
				peerId.substr(21,63) + "<span style='color:white'> " + joinMsg[the_class.language] + "</span></span></div>";
			messages.innerHTML += msgString;

			/*Log*/
			chatLog.log.push({"timestamp": chatTimestamp.toISOString(), "hash": "", "origin": "system", "content": decodeURIComponent(peerId.substr(0,12).replace(/-/g, "%")) + " " + peerId.substr(21,63) + " " + joinMsg[the_class.language]});
			chatLog.log[chatLog.log.length - 1].hash = await digestMessage(Object.values(chatLog.log[chatLog.log.length - 1]).join());
			messages.scrollTop = messages.scrollHeight * 2;
		});
		room.on('stream', async stream => {
			var videoDiv = document.createElement('div');
			videoDiv.className = "face";
			const newVideo = document.createElement('video');
			newVideo.srcObject = stream;
			newVideo.playsInline = true;
			newVideo.setAttribute('data-peer-id', stream.peerId);
			var peerName = document.createElement('span');
			peerName.style.color = "rgba(" + stream.peerId.substr(12, 3) + ", " + stream.peerId.substr(15, 3) + ", " + stream.peerId.substr(18, 3) + ", 1)";
			peerName.innerHTML = decodeURIComponent(stream.peerId.substr(0,12).replace(/-/g, "%")) + ' ' + stream.peerId.substr(21,63);
			remoteVideos.append(videoDiv);
			videoDiv.append(newVideo, peerName);
			await newVideo.play().catch(console.error);
		});
		room.on('data', async ({data, src}) => {
			chatTimestamp.setTime(Date.now());
			var theirMsg = "<div class='their-msg' style='background-color: rgba(" +
				Math.floor(src.substr(12, 3) / 3) +
				", " + Math.floor(src.substr(15, 3) / 3) +
				", " + Math.floor(src.substr(18, 3) / 3) + ", 0.8)'> <span style='color: rgba(" +
				src.substr(12, 3) +	", " + src.substr(15, 3) + ", " + src.substr(18, 3) + ", 1)'>" +
				decodeURIComponent(src.substr(0,12).replace(/-/g, "%")) + ' ' +
				src.substr(21,63) + "</span>";

			theirMsg += "<span class='chat-time' title='" + chatTimestamp.toISOString() + "'>" + chatTimestamp.toTimeString().substr(0,5) + "</span>";

			if(urlRegex.test(data) && data.includes(".jpg") || data.includes(".jpeg") || data.includes(".png") || data.includes(".svg")) {
				theirMsg += "<img class='chat-img' src='" + data + "'/>";
			} else if(urlRegex.test(data)) {
				theirMsg += "<a href='//" + data + "'>" + data + "</a>";
			} else {
				theirMsg += "<span>" + data + "</span>";
			};
			theirMsg += "</div>";
			messages.innerHTML += theirMsg;

			/*Log*/
			chatLog.log.push({"timestamp": chatTimestamp.toISOString(), "hash": "", "origin": src, "content": data});
			chatLog.log[chatLog.log.length - 1].hash = await digestMessage(Object.values(chatLog.log[chatLog.log.length - 1]).join());
			messages.scrollTop = messages.scrollHeight * 2;
		});
		room.on('peerLeave', async peerId => {
			chatTimestamp.setTime(Date.now());
			const remoteVideo = remoteVideos.querySelector(
				`[data-peer-id=${peerId}]`
			);
			remoteVideo.srcObject.getTracks().forEach(track => track.stop());
			remoteVideo.srcObject = null;
			remoteVideo.parentElement.remove();
			var msgString = "<div class='server-msg'><span title='" + chatTimestamp.toISOString() + "' style='color: rgba(" +
				peerId.substr(12, 3) + ", " + peerId.substr(15, 3) + ", " + peerId.substr(18, 3) + ", 1)'>" +
				decodeURIComponent(peerId.substr(0,12).replace(/-/g, "%")) + ' ' +
				peerId.substr(21,63) + "<span style='color:white'> " + leaveMsg[the_class.language] + "</span></span></div>";
			messages.innerHTML += msgString;

			/*Log*/
			chatLog.log.push({"timestamp": chatTimestamp.toISOString(), "hash": "", "origin": peerId, "content": decodeURIComponent(peerId.substr(0,12).replace(/-/g, "%")) + " " + peerId.substr(21,63) + " " + leaveMsg[the_class.language]});
			chatLog.log[chatLog.log.length - 1].hash = await digestMessage(Object.values(chatLog.log[chatLog.log.length - 1]).join());
			messages.scrollTop = messages.scrollHeight * 2;
		});
		room.once('close', async () => {
			chatTimestamp.setTime(Date.now());
			sendButton.removeEventListener('click', onClickSend);
			var msgString = "<div class='server-msg'><span title='" + chatTimestamp.toISOString() + "'>" + farewellMsg[the_class.language] + "</span></div>";
			messages.innerHTML += msgString; 

			/*Log*/
			chatLog.log.push({"timestamp": chatTimestamp.toISOString(), "hash": "", "origin": "system", "content": farewellMsg[the_class.language]});
			chatLog.log[chatLog.log.length - 1].hash = await digestMessage(Object.values(chatLog.log[chatLog.log.length - 1]).join());
			messages.scrollTop = messages.scrollHeight * 2;

			Array.from(remoteVideos.children).forEach(remoteVideo => {
				remoteVideo.children[0].srcObject.getTracks().forEach(track => track.stop());
				remoteVideo.children[0].srcObject = null;
				remoteVideo.remove();
			});
		});
		sendButton.addEventListener('click', onClickSend);
		// fileButton.addEventListener('click', onClickFile);
		saveChatButton.setAttribute('onclick', "this.nextSibling.click()");
		saveChatButton.nextSibling.addEventListener('click', saveChat);
		leaveButton.addEventListener('click', () => room.close(), {
			once: true
		});
		document.querySelector('#send-text').addEventListener('keyup', function (e) {
			if(e.shiftKey && e.keyCode == 13) {} else if(e.keyCode == 13) {
				e.preventDefault();
				onClickSend();
			};
		});

		async function onClickSend() {
			if(localText.innerText != "") {
				chatTimestamp.setTime(Date.now());
				room.send(localText.innerText);
				var myMsg = "<div class='my-msg' style='background-color: rgba(" +
					Math.floor(peer.id.substr(12, 3) / 3) +
					", " + Math.floor(peer.id.substr(15, 3) / 3) +
					", " + Math.floor(peer.id.substr(18, 3) / 3) + ", 0.8)'> <span style='color: rgba(" +
					peer.id.substr(12, 3) +	", " + peer.id.substr(15, 3) + ", " + peer.id.substr(18, 3) + ", 1)'>" +
					decodeURIComponent(peer.id.substr(0,12).replace(/-/g, "%")) + " " +
					peer.id.substr(21,63) + "</span>";

				myMsg += "<span class='chat-time' title='" + chatTimestamp.toISOString() + "'>" + chatTimestamp.toTimeString().substr(0,5) + "</span>";

				if(urlRegex.test(localText.innerText) && localText.innerText.includes(".jpg") 
					|| localText.innerText.includes(".jpeg") || localText.innerText.includes(".png") 
					|| localText.innerText.includes(".svg")) {
					myMsg += "<img class='chat-img' src='" + localText.innerText + "'/>";
				} else if(urlRegex.test(localText.innerText)) {
					myMsg += "<a class='chat-link' href='//" + localText.innerText + "'>" + localText.innerText + "</a>";
				} else {
					myMsg += "<span>" + localText.innerText + "</span>";
				};
				myMsg += "</div>";
				messages.innerHTML += myMsg;
				/*Log*/
				chatLog.log.push({"timestamp": chatTimestamp.toISOString(), "hash": "", "origin": peer.id, "content": localText.innerText});
				chatLog.log[chatLog.log.length - 1].hash = await digestMessage(Object.values(chatLog.log[chatLog.log.length - 1]).join());
				messages.scrollTop += messages.scrollHeight * 2;
				localText.innerHTML = '';
			}
		}

		async function saveChat() {
			chatLog.hash = await digestMessage(JSON.stringify(chatLog.log));
			var filename = "chatlog_" + chatTimestamp.toISOString() + ".json";
			var file = new Blob([JSON.stringify(chatLog)],  {type: "application/json; charset=utf-8"});
			var url = URL.createObjectURL(file);
			saveChatButton.setAttribute("href", url);
			saveChatButton.setAttribute("download", filename);
		}
	});
	peer.on('error', console.error);
};

var targets = document.querySelectorAll("[contenteditable]");
for(t = 0; t < targets.length; t++) {
	targets[t].addEventListener('paste', handlePaste);
};

function handlePaste(e) {
	var clipboardData, pastedData;
	e.stopPropagation();
	e.preventDefault();
	clipboardData = e.clipboardData || window.clipboardData;
	pastedData = clipboardData.getData('Text');
	this.innerText = pastedData;
}

async function digestMessage(message) {
	const msgUint8 = new TextEncoder().encode(message);
	const hashBuffer = await crypto.subtle.digest('SHA-1', msgUint8);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
	return hashHex;
}

