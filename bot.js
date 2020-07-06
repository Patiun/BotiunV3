//#region modules
const process = require("process");
const WebSocket = require("ws");
const fs = require("fs");
const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
var mysql = require('mysql');
//#endregion modules

//#region File locations
const botConfig = require("./botConfig.json");
const { SSL_OP_SSLEAY_080_CLIENT_DH_BUG } = require("constants");
const fileChannels = botConfig.files.channels;
const fileIgnoredUsers = botConfig.files.ignoredUsers;
const ssl = {
  key: fs.readFileSync(botConfig.cert.key),
  cert: fs.readFileSync(botConfig.cert.cert)
}
//#endregion

//#region Botiun Authentication Stuffs
const botName = botConfig.botName;
const token = botConfig.token;
const clientId = botConfig.clientId;
//#endregion

//#region Server Details
const serverIRC = "irc://irc.chat.twitch.tv";
const portIRC = 6667;
const serverWS = "ws://irc-ws.chat.twitch.tv";
const portWS = 80;
//#endregion

//#region Database Connection
var connection = mysql.createConnection(botConfig.db);
connection.connect();
//TODO end connection on close and exit
//#endregion

//#region globals
//Badge Details
//const trackedBadges = ['founder', 'broadcaster', 'staff', 'bits', 'bits-leader', 'partner', 'moderator', 'vip', 'subscriber', 'premium', 'sub-gift-leader', 'sub-gifter', 'glhf-pledge', 'bits-charity', 'turbo'];
let unknownBadges = [];

//Target Channels
let channels = [];
//TODO Create an implement tracked active channels
let roomstates = {};
let botstates = {};
let counters = {};
let countersDefault = {
  nani: 0,
  f: 0,
};
let controlBools = {};
let controlBoolsDefault = {
  nani: true,
  f: true,
};
let timers = {};

//current users
let superUsers = botConfig.superUsers;
let ignoredUsers = [];
let users = {};
let seenUsers = {};
let messages = {};

//settings
let verbose = true;
let settings = {};
let settingDefault = {
  messages: true,
};
const messageStorageLimit = 100;
//#endregion

//---------------------------------------------------------------------------------
// ~~~~~~~~~~~~~~~~~VVVVVVVVVVVVVVVVVV Scripted VVVVVVVVVVVVVVVVVV~~~~~~~~~~~~~~~~~
//---------------------------------------------------------------------------------
//#region Startup
async function initializeBot() {
  try {
    //Load ignored users
    let ignoredUserData = fs.readFileSync(fileIgnoredUsers, "utf8");
    ignoredUsers = ignoredUserData.split("\n").map((x) => {
      return x.trim().toLowerCase();
    });

    //Load channels
    let channelsData = fs.readFileSync(fileChannels, "utf8");
    channels = channelsData.split("\n").map((x) => {
      return x.trim().toLowerCase();
    });

    console.log(`${botName} is online!`);
    return;
  } catch (error) {
    console.log("Error intializing Bot");
    console.log(error);
    return;
  }
}

process.on("exit", () => {
  console.log("Exiting " + botName);
});
//#endregion

//#region Web Server
const port = process.env.PORT || 4001;
const app = express();
const server = http.createServer(ssl,app);
const io = socketIo(server);
const publicHtmlConfig = { root: "./Public_Html" };
const soundConfig = { root: "./Sounds" };

server.listen(port, () => {
  console.log(`Web Server listening at port ${port}`);
});
app.get("/", function (req, res) {
  res.sendFile("index.html", publicHtmlConfig);
});

app.use(express.static("Sounds"));
app.use(express.static("Public_Html"));

app.get("/test", function (req, res) {
  res.sendFile("index.html", publicHtmlConfig);
});

app.get("/overlay", function (req, res) {
  res.sendFile("Test.html", publicHtmlConfig);
})

app.get("/firework", function (req, res) {
  res.sendFile("Fireworks.html", publicHtmlConfig);
})

app.get("/five_lives/firework", function (req, res) {
  res.sendFile("fiveLivesFireworks.html", publicHtmlConfig);
})

app.get("/overlay/orcishfiddler", function (req, res) {
  res.sendFile("mainOverlayEiagra.html", publicHtmlConfig);
});

app.get("/Orc-Dance-01", function (req, res) {
  res.sendFile("Eiagra-Sexy-Dance-01.webm", publicHtmlConfig);
});

io.on("connection", (socket) => {
  socket.on("disconnect", (details) => {
    console.log("user disconnected");
    console.log(details);
  });
});

function playSoundToOverlay(channel, soundFileName) {
  io.emit("playSound", { channel: channel, soundFileName: soundFileName });
}
//#endregion

//#region IRC
const irc = new WebSocket(`${serverWS}:${portWS}`);

irc.on("message", function incoming(data) {
  processIncomingData(data);
});

irc.on("open", async function open() {
  await initializeBot();

  irc.send(`PASS ${token}`);
  irc.send(`NICK ${botName.toLowerCase()}`);
  irc.send(`CAP REQ :twitch.tv/membership`);
  irc.send(`CAP REQ :twitch.tv/tags`);
  irc.send(`CAP REQ :twitch.tv/commands`);
  for (let channel of channels) {
    await connectToChannel(channel);
  }
});

async function connectToChannel(channel) {
  users[channel] = [];
  seenUsers[channel] = [];
  messages[channel] = {};
  settings[channel] = JSON.parse(JSON.stringify(settingDefault));
  timers[channel] = {
    connection: setTimeout(() => {
      alertFailureToConnect(channel);
    }, 2 * 1000),
  };
  counters[channel] = JSON.parse(JSON.stringify(countersDefault));
  controlBools[channel] = JSON.parse(JSON.stringify(controlBoolsDefault));


  await query(`SELECT * FROM channel WHERE twitchId = '${channel}';`).then(results => {
    if (results.length <= 0) {
      query(`INSERT INTO channel (twitchId) VALUES('${channel}');`).then(results => {
        console.log("Connected to " + channel + " for first time");
      }).catch(error => { throw error; });
    }
  }).catch(error => {
    throw error;
  });

  irc.send(`JOIN #${channel.toLowerCase()}`);

  return;
}

function alertFailureToConnect(channel) {
  console.log("Failed to connect to " + channel);
  let channelIndex = channels.indexOf(channel);
  channels.splice(channelIndex, 1);
}
//#endregion

//#region Console
var stdin = process.openStdin();

stdin.addListener("data", function (d) {
  let inputString = d.toString().trim();
  let inputParams = inputString.split(" ");
  let command = inputParams[0];
  switch (command.toLowerCase()) {
    case "who":
      console.log(users);
      break;
    case "seen":
      console.log(seenUsers);
      break;
    case "connect":
      if (inputParams.length > 1) {
        let channel = inputParams[1].toLowerCase();
        if (channels.includes(channel)) {
          console.log(channel + " was already connected to.");
          break;
        } else {
          console.log("Trying to connect to " + channel);
          connectToChannel(channel);
        }
      }
      break;
    case "register":
      if (inputParams.length > 1) {
        let channel = inputParams[1].toLowerCase();
        if (channels.includes(channel)) {
          console.log(channel + " was already registered to.");
          break;
        } else {
          console.log("Tryin to register to " + channel);
          registerChannel(channel);
        }
      }
      break;
    case "send":
      if (inputParams.length >= 3) {
        let channel = inputParams[1].toLowerCase();
        let message = inputParams.splice(2, inputParams.length).join(" ");
        sendMessage(channel, message);
      }
      break;
    case "registerbot":
      if (inputParams.length >= 2) {
        let username = inputParams[1];
        registerIgnoredUser(username);
      }
      break;
    case "verbose":
    case "setverbose":
    case "toggleverbose":
      verbose = !verbose;
      console.log("Verbose setting: " + verbose);
      break;
    case "togglemessage":
    case "togglemessages":
      if (inputParams.length > 1) {
        let channel = inputParams[1].toLowerCase();
        if (settings[channel]) {
          settings[channel].message = !settings[channel].message;
          console.log(
            channel + " showing messages: " + settings[channel].message
          );
          break;
        } else {
          console.log("Channel " + channel + " is not connected");
        }
      } else {
        console.log("No channel specified.");
      }
      break;
    case "raffles":
      if (inputParams.length > 1) {
        let channel = inputParams[1].toLowerCase();
        if (timers[channel]) {
          if (timers[channel].raffles) {
            console.log("Stopping Raffles");
            clearTimeout(timers[channel].raffles);
          } else {
            console.log("Starting Random Raffles");
            timers[channel].raffles = setTimeout(() => {
              randomRaffle(channel);
            }, (Math.floor(Math.random() * 10) + 5) * 60 * 1000)
          }
        } else {
          console.log("Channel " + channel + " is not connected");
        }
      } else {
        console.log("No channel specified.");
      }
      break;
    case "firework":
      io.sockets.emit('playFirework', { channel: 'patiun' });
      break;
    case "fireworks":
      fwCount = 0;
      fireFireworkChain();
      break;
    case "close":
    case "exit":
      connection.end();
      process.exit();
      break;
    default:
      break;
  }
});

//TODO TEMP
let fwCount = 0;
function fireFireworkChain() {
  io.sockets.emit('playFirework', { channel: 'patiun' });
  fwCount += 1;
  if (fwCount < 10) {
    setTimeout(() => { fireFireworkChain(); }, Math.random(2000) + Math.random(800) * Math.random(800) + 350);
  }
}


function randomRaffle(channel) {
  let amount = (Math.floor(Math.random() * 15) + 5) * 100;

  sendMessage(channel, "!raffle " + amount)
  fwCount = 0;
  fireFireworkChain();

  timers[channel].raffles = setTimeout(() => {
    randomRaffle(channel);
  }, (Math.floor(Math.random() * 10) + 5) * 60 * 1000)
}
//#endregion
//----------------------------------------------------------------------------------
// ~~~~~~~~~~~~~~~~~VVVVVVVVVVVVVVVVVV Functions VVVVVVVVVVVVVVVVVV~~~~~~~~~~~~~~~~~
//----------------------------------------------------------------------------------
//#region Registration
async function registerChannel(channel) {
  if (channels.indexOf(channel) === -1) {
    channels.push(channel);
    connectToChannel(channel);
    //Write channel name to channels files
    try {
      fs.appendFileSync(fileChannels, "\n" + channel);
    } catch (error) {
      console.error(error);
    }
  } else {
    console.log(`${channel} is already regustered.`);
  }
}

function registerIgnoredUser(username) {
  if (ignoredUsers.indexOf(username) === -1) {
    ignoredUsers.push(username);
    //Write username to ignored user files
    try {
      fs.appendFileSync(fileIgnoredUsers, "\n" + username);
    } catch (error) {
      console.error(error);
    }
  } else {
    console.log(`${username} is already a registered ignored user.`);
  }
}
//#endregion

//#region Handle IRC
async function processIncomingData(data) {
  let pingCheck = data.substring(0, 4);
  if (pingCheck === "PING") {
    irc.send("PONG :tmi.twitch.tv");
    return;
  }
  let events = data.split("\n");
  for (let eventData of events) {
    if (eventData) {
      let timeStamp = new Date().getTime();
      const { event, channel, username, metadata, payload } = parseEventData(
        eventData
      );
      if (ignoredUsers.includes(username)) {
        continue;
      }
      switch (event) {
        case "PRIVMSG":
          metadata.timeStamp = timeStamp;
          handleMessage(channel, username, payload, metadata);
          break;
        case "JOIN":
          if (verbose) {
            console.log(
              "%c[" +
              event +
              "] " +
              username +
              " joined #" +
              channel +
              " at " +
              timeStamp,
              "color: #00ff00"
            );
          }
          handleJoin(channel, username, { timeStamp: timeStamp });
          break;
        case "PART":
          if (verbose) {
            console.log(
              "%c[" +
              event +
              "] " +
              username +
              " parted #" +
              channel +
              " at " +
              timeStamp,
              "color: #aa00aa"
            );
          }
          handlePart(channel, username, { timeStamp: timeStamp });
          break;
        case "USERSTATE":
          metadata.timeStamp = timeStamp;
          handleUserState(channel, metadata);
          break;
        case "USERNOTICE":
          metadata.timeStamp = timeStamp;
          handleUserNotice(channel, payload, metadata);
          break;
        case "ROOMSTATE":
          metadata.timeStamp = timeStamp;
          handleRoomState(channel, metadata);
          break;
        case "CLEARCHAT":
          //console.log("%c[" + event + "] " + timeStamp, 'color: #ff0000');
          metadata.timeStamp = timeStamp;
          handleClearChat(channel, payload, metadata);
          break;
        case "CLEARMSG":
          metadata.timeStamp = timeStamp;
          handleClearMessage(channel, payload, metadata); //@login=poolfullofghoul;room-id=;target-msg-id=4b37e4f4-0534-4b65-ac3f-8f49c9e368ea;tmi-sent-ts=1583850112426 :tmi.twitch.tv CLEARMSG #invadervie :simping for my gf
          break;
        case "HOSTTARGET":
          handleHostTarget(channel, payload, metadata);
          //console.log("%c[" + event + "] " + timeStamp, 'color: #aaa');
          //console.log(channel, username, payload, metadata);
          break;
        case "NOTICE":
          handleNotice(channel, payload, metadata);
          //console.log("%c[" + event + "] " + timeStamp, 'color: #aaa');
          //console.log(channel, username, payload, metadata);
          break;
        case botName.toLowerCase():
          loadNamesList(username, payload);
          break;
        case "*":
          //console.log('C', channel, 'U', username, 'P', payload, 'M', metadata);
          //Ignore this
          break;
        default:
          console.log("\n[!!!] Unknown Event: " + event);
          console.log(eventData);
          break;
      }
    }
  }
}

function parseEventData(data) {
  let tokens = data.split(" ");
  let length = tokens.length;
  let start = tokens.splice(0, 4);

  let event = "{NE}";
  let metadata = {};
  let channel = "{NC}";
  let username = "{NU}";
  let payload = "{NP}";
  try {
    if (length <= 3) {
      username = start[0].substring(1, start[0].length).trim();
      username = username.split("!")[0];
      event = start[1].trim();
      channel = start[2].substring(1, start[2].length).trim();
      payload = username;
    } else {
      metadata = start[0];
      username = start[1].substring(1, start[1].length).trim();
      username = username.split("!")[0];
      event = start[2].trim();
      channel = start[3].substring(1, start[3].length).trim();
      payload = tokens.join(" ");
      payload = payload.substring(1, payload.length).trim();
      //Parse metadata
      metadata = metadata.substring(1, metadata.length);
      metadataTokens = metadata.split(";");
      metaObj = {};
      for (let token of metadataTokens) {
        let tokenData = token.split("=");
        metaObj[tokenData[0]] = tokenData.length > 1 ? tokenData[1] : "";
      }
      metadata = metaObj;
      if (username === "OSTTARGET") {
        //TODO Figure out how to fix this instead of this weird case ":tmi.twitch.tv HOSTTARGET #tabzzhd :kippenbro -"
        event = "HOSTTARGET"; //start[1].trim();
        username = start[0];
        channel = start[2].substring(1, start[3].length).trim();
        payload = start[3].substring(1, start[3].length).trim();
      }
    }
  } catch (error) {
    console.log(error);
    console.log(data);
  }
  return {
    event: event,
    channel: channel,
    username: username,
    metadata: metadata,
    payload: payload,
  };
}

async function handleJoin(channel, username, data) {
  let indexOfUsername = users[channel].indexOf(username);
  let firstJoin = false;
  if (indexOfUsername === -1) {
    //First join
    firstJoin = true;
    users[channel].push(username);
    seenUsers[channel].push(username);
  }
  addUserToDB(username, channel, (channel === username) ? 1 : 0).then(result => { }).catch(error => { console.log(error); });
  try {
    query(`SELECT * FROM user WHERE twitchId = '${username}' AND channel = '${channel}'`).then(result => {
      if (result.length <= 0) {
        return;
      }
      let userData = result[0];
      if (firstJoin && userData.vip) {
        playSoundToOverlay(channel, 'Entrance-Fanfair-Shrek.mp3');
      }
      if (firstJoin && userData.mod) {
        //TODO Imperial March
      }
    }).catch(error => { console.log(error) });
  } catch (error) {
    console.log(error);
  }
}

async function handlePart(channel, username, data) {
  let indexOfUsername = users[channel].indexOf(username);
  if (indexOfUsername != -1) {
    users[channel].splice(indexOfUsername, 1);
  }
  addUserToDB(username, channel, (channel === username) ? 1 : 0);
}

async function handleMessage(channel, username, payload, data) {
  //get badges from data
  let rawBadgeString = data.badges;
  let badgeData = {};
  let badgeOutput = "";
  if (rawBadgeString.length > 0) {
    rawBadgeData = rawBadgeString.split(",");
    for (let i = 0; i < rawBadgeData.length; i++) {
      let badgeLine = rawBadgeData[i];
      badgeLineData = badgeLine.split("/");
      if (badgeLineData.lenght < 2) {
        badgeLineData.push(0);
      }
      badgeData[badgeLineData[0]] = parseInt(badgeLineData[1]);
      if (badgeLineData[0].substring(0, 9) === "twitchcon") {
        badgeLineData[0] = "twitchcon";
      }
      switch (badgeLineData[0]) {
        case "founder":
          badgeOutput += " [F" + badgeLineData[1] + "]";
          break;
        case "moderator":
          badgeOutput += " [MOD]";
          break;
        case "subscriber":
          badgeOutput += " [S" + badgeLineData[1] + "]";
          break;
        case "sub-gift-leader":
          badgeOutput += " [SGL" + badgeLineData[1] + "]";
          break;
        case "sub-gifter":
          badgeOutput += " [SG" + badgeLineData[1] + "]";
          break;
        case "vip":
          badgeOutput += " [VIP]";
          break;
        case "broadcaster":
          badgeOutput += " [Streamer]";
          break;
        case "bits":
          badgeOutput += " [B" + badgeLineData[1] + "]";
          break;
        case "bits-charity":
          badgeOutput += " [BC" + badgeLineData[1] + "]";
          break;
        case "bits-leader":
          badgeOutput += " [BL" + badgeLineData[1] + "]";
          break;
        case "premium":
          badgeOutput += " [TP]";
          break;
        case "partner":
          badgeOutput += " [P*]";
          break;
        case "glhf-pledge":
          badgeOutput += " [glhf]";
          break;
        case "turbo":
          badgeOutput += " [T]";
          break;
        case "hype-train":
          badgeOutput += " [HT" + badgeLineData[1] + "]";
          break;
        case "twitchcon":
          badgeOutput += " [TC]";
          break;
        case "staff":
          badgeOutput += " [Staff]";
          break;
        default:
          badgeOutput += " [?" + badgeLineData[1] + "]";
          if (!unknownBadges.includes(badgeLineData[0])) {
            unknownBadges.push(badgeLineData[0]);
            console.log("New Badge Seen: " + badgeLineData[0]);
          }
          break;
      }
    }
  }

  if (settings[channel].messages) {
    console.log(
      "%c\n[MESSAGE] #" + channel + " @ " + data.timeStamp,
      "color: #bada55"
    );
    console.log(
      "%c" + username + badgeOutput + ": " + payload,
      "color: #bada55"
    );
  }

  if (!seenUsers[channel].includes(username)) {
    console.log(username + " chatted before we saw them in #" + channel);
    await handleJoin(channel, username, data); //May be adding people who just left or will never register as leaving and may stay in the list forever
    saveMessageFromUser(channel, username, payload, badgeData, data);
    processMessage(channel, username, payload, badgeData, data);
  } else {
    saveMessageFromUser(channel, username, payload, badgeData, data);
    processMessage(channel, username, payload, badgeData, data);
  }
  //TODO kick off handle message processing here
}

function handleUserNotice(channel, payload, data) {
  let msgId = data["msg-id"];
  let username = data["display-name"];
  //system-msg:"mastopro\ssubscribed\swith\sTwitch\sPrime."
  //msg-param-sub-plan:"Prime"
  //msg-param-sub-plan-name:"Channel\sSubscription\s(invader_vie)"
  switch (msgId) {
    case "sub":
      console.log(`\n${username} subbed to ${channel}! (${data.timeStamp})`);
      if (payload) {
        console.log("Message: " + payload);
      }
      break;
    case "resub":
      console.log(
        `\n${username} resubbed to ${channel} for ${data["msg-param-cumulative-months"]} months! (${data.timeStamp})`
      );
      if (payload) {
        console.log("Message: " + payload);
      }
      break;
    case "giftpaidupgrade":
      console.log(
        `\n${username} is continuing a gifted sub to ${channel}! (${data.timeStamp})`
      );
      if (payload) {
        console.log("Message: " + payload);
      }
      break;
    case "submysterygift":
      console.log(
        `\n${username} is gifting ${data["msg-param-mass-gift-count"]} sub(s) to #${channel}! (${data.timeStamp})`
      );
      if (payload) {
        console.log("Message: " + payload);
      }
      break;
    case "subgift":
      console.log(
        `\n${data["msg-param-recipient-display-name"]} received a gifted sub to from ${username} to #${channel}! (${data.timeStamp})`
      );
      if (payload) {
        console.log("Message: " + payload);
      }
      break;
    case "rewardgift":
      console.log(
        `\n[?] ${data["msg-param-recipient-display-name"]} triggered reward gift from ${username} to #${channel}! (${data.timeStamp})`
      );
      if (payload) {
        console.log("Message: " + payload);
      }
      console.log(data);
      break;
    case "ritual":
      console.log(
        `\nA ritual (${data["msg-param-ritual-name"]}) for ${username} has occured in #${channel} (${data.timeStamp})`
      );
      if (payload) {
        console.log("Message: " + payload);
      }
      //console.log(data);
      break;
    case "raid":
      username = data["msg-param-displayName"];
      viewerCount = data["msg-param-viewerCount"];
      console.log(
        `\n${username} is raiding #${channel} with ${viewerCount} viewers! (${data.timeStamp})`
      );
      console.log(data);
      break;
    case "unraid":
      username = data["msg-param-displayName"];
      console.log(
        `\n${username} is no longer raiding #${channel} (${data.timeStamp})`
      );
      console.log(data);
      break;
    case "bitsbadgetier":
      let badgeTier = data["msg-param-threshold"];
      console.log(
        `\n${username} unlocked the bits badge: ${badgeTier} (${data.timeStamp})`
      );
      console.log(data);
      break;
    default:
      console.log("\nUnknown Notice event: " + msgId);
      console.log(data);
      break;
  }
}

function handleNotice(channel, payload, data) {
  let noticeType = data["msg-id"];
  switch (noticeType) {
    case "host_on":
      console.log(`\n${channel} ${payload}`);
      break;
    default:
      console.log("\nUnnown notice type: " + noticeType);
      console.log(channel, payload, data);
      break;
  }
}

function handleHostTarget(channel, payload, data) {
  console.log(`\n${channel} is targeting a host at ${payload}`);
  //console.log(data);
}

function handleRoomState(channel, data) {
  console.log("\nCurrent roomstate of " + channel);
  console.log(data);
  if (!roomstates[channel]) {
    roomstates[channel] = data;
  } else {
    //Compare to last roomstate
    roomstates[channel] = data;
  }
}

function handleUserState(channel, data) {
  clearTimeout(timers[channel].connection);
  //console.log(data);
  if (!botstates[channel]) {
    botstates[channel] = data;
  } else {
    //Compare to last roomstate
    botstates[channel] = data;
  }
}

function handleClearChat(channel, username, data) {
  let duration = data["ban-duration"];
  if (!duration) {
    duration = "ever";
  } else {
    duration = " " + duration;
    duration += " seconds";
  }
  console.log(
    `\n%c[CLEARCHAT] ${username} was banned on ${channel}'s channel for${duration} @ ${new Date(
      data.timeStamp
    ).toLocaleString()}`,
    "color: #ff0000"
  );
  if (messages[channel][username] && messages[channel][username].length > 0) {
    let count =
      messages[channel][username].length < 5
        ? messages[channel][username].length
        : 5;
    for (let i = 1; i < count + 1; i++) {
      console.log(
        "Last message: " +
        messages[channel][username][messages[channel][username].length - i]
          .message +
        " @ " +
        new Date(
          messages[channel][username][
            messages[channel][username].length - i
          ].timeStamp
        ).toLocaleString()
      );
    }
  }
  //console.log(data);
  if (data["ban-duration"]) {
    removeLastMessagesForUser(channel, username, 5); //remove last X chats from history
  } else {
    removeAllMessagesForUser(channel, username);
  }
  handlePart(channel, username, data); //Remove user from stream when banned
}

function handleClearMessage(channel, payload, data) {
  let username = data.login;
  console.log(
    `\n%c[CLEARCHAT] ${username}'s message "${payload}" was cleared on ${channel}'s channel @ ${data.timeStamp}`,
    "color: #ff0000"
  );
  removeMessageForUser(channel, username, payload); //remove message from chat history
}

function loadNamesList(code, namesListData) {
  if (parseInt(code) === 53) {
    let tokens = namesListData.trim().split(" ");
    let channel = tokens[0];
    let firstUser = tokens[1].substring(1, tokens[1].length);
    let remainingUsers = [firstUser].concat(tokens.splice(2, tokens.length));
    let time = new Date().getTime();
    for (let i = 0; i < remainingUsers.length; i++) {
      let username = remainingUsers[i];
      if (ignoredUsers.indexOf(username) === -1) {
        handleJoin(channel, username, { timeStamp: time });
      }
    }
  }
}
//#endregion

//#region Send Messages
function sendMessage(channel, message) {
  console.log("\nTrying to send message to " + channel + ": " + message);
  if (channels.indexOf(channel) > -1) {
    irc.send(`PRIVMSG #${channel} :${message}`);
  }
}

function sendMessageToUser(channel, username, message) {
  sendMessage(channel, `@${username} ${message}`);
}
//#endregion

//#region Message Storage
async function saveMessageFromUser(channel, username, message, badges, data) {
  if (ignoredUsers.includes(username) || ['streamelements'].includes(username) || message.length <= 0) {
    return;
  }

  let now = new Date();
  let lastSeen = now.getTime();

  let broadcaster = (badges.hasOwnProperty('broadcaster')) ? 1 : 0;
  let vip = (badges.hasOwnProperty('vip')) ? 1 : 0;
  let mod = (badges.hasOwnProperty('moderator')) ? 1 : 0;
  let sub1 = (badges.subscriber || badges.hasOwnProperty('founder')) ? 1 : 0;
  let sub2 = ((badges.subscriber) && (badges.subscriber >= 2000)) ? 1 : 0;
  let sub3 = ((badges.subscriber) && (badges.subscriber >= 3000)) ? 1 : 0;
  let command = (message.charAt(0) === '!') ? 1 : 0;

  if (data['custom-reward-id']) {
    command = 1; //Channel Point Redemption TODO make this better?
  }

  message = message.replace(/"/g, '\\"');

  //UPDATE USER
  query(`
  UPDATE user
  SET broadcaster = ${broadcaster}, vip = ${vip}, \`mod\` = ${mod}, sub1 = ${sub1}, sub2 = ${sub2}, sub3 = ${sub3}, lastSeen = ${lastSeen}
  WHERE twitchId = '${username}' AND channel = '${channel}';
  `)
    .then(result => {

    })
    .catch(error => { console.log(error) });

  //SAVE MESSAGE CONTENTS
  await query(`
  INSERT INTO messages (twitchId, channel, badgeDetails, message, command, timeStamp)
  VALUE ('${username}','${channel}','${JSON.stringify(badges)}',"${message}",${command},${data.timeStamp});
  `)
    .then(result => {

    })
    .catch(error => { console.log(error) });
}

function removeMessageForUser(channel, username, message) {
  if (messages[channel][username]) {
    for (let i = 0; i < messages[channel][username].length; i++) {
      if (messages[channel][username][i].message === message) {
        messages[channel][username].splice(i, 1);
        return;
      }
    }
    //Only get here if we didn't find the message
    console.log(
      `Could not find "${message}" for ${username} in ${channel}'s channel to remove.`
    );
  } else {
    console.log(
      "No messages to remove from for " +
      username +
      " in " +
      channel +
      "'s channel"
    );
  }
}

function removeLastMessagesForUser(channel, username, messageCount) {
  if (messages[channel][username]) {
    for (let i = 0; i < messageCount; i++) {
      if (messages[channel][username].length <= 0) {
        return;
      }
      messages[channel][username].pop();
    }
  } else {
    console.log(
      "No messages to remove from for " +
      username +
      " is " +
      channel +
      "'s channel"
    );
  }
}

function removeAllMessagesForUser(channel, username) {
  if (messages[channel][username]) {
    delete messages[channel][username];
  }
}
//#endregion

//#region Message Handling
let thresholdNani = 5;
let thresholdF = 5;
function processMessage(channel, username, payload, badgeData, data) {
  let meta = { channel: channel, username: username };
  let cleanedTokens = payload.toLowerCase().split(" ");
  //Nani
  if (
    cleanedTokens.indexOf("nani") >= 0 ||
    cleanedTokens.indexOf("!nani") >= 0 ||
    cleanedTokens.indexOf("nani!") >= 0 ||
    cleanedTokens.indexOf("nani?") >= 0
  ) {
    playSoundToOverlay(channel, "nani.mp3");
    /* Propper logic turned off for the memes
    if (controlBools[channel].nani) {
      counters[channel].nani += 1;
      if (counters[channel].nani >= thresholdNani) {
        counters[channel].nani = 0;
        controlBools[channel].nani = false;
        timers[channel].nani = setTimeout(() => {
          controlBools[channel].nani = true;
        }, 30 * 1000);
        console.log("NANI");
        playSoundToOverlay(channel,'nani.mp3');
      }
    } else {
      console.log("Nani seen but control off");
    }*/
  }
  //F
  if (cleanedTokens.indexOf("f") >= 0 || cleanedTokens.indexOf("!f") >= 0) {
    if (controlBools[channel].f) {
      counters[channel].f += 1;
      if (counters[channel].f >= thresholdF) {
        counters[channel].f = 0;
        controlBools[channel].f = false;
        timers[channel].f = setTimeout(() => {
          controlBools[channel].f = true;
        }, 30 * 1000);
        console.log("F");
      }
    } else {
      console.log("F seen but control off");
    }
  }
  //Sexy Orc Dance 01
  let sexyOrcUsers = ["eiagra", "streamelements"];
  if (
    sexyOrcUsers.includes(username.toLowerCase()) ||
    superUsers.includes(username.toLowerCase() || username.toLowerCase() === channel)
  ) {
    if (
      cleanedTokens.includes("orcs") &&
      cleanedTokens.includes("beefy") &&
      cleanedTokens.includes("negotiable")
    ) {
      io.sockets.emit("orcDance01", { channel: channel });
    }
  }

  function fireFirework(fireworkTokens) {
    let dataPacket = { channel: channel };
    switch (fireworkTokens[0]) {
      case 'b':
      case 'blue':
        dataPacket.fireworkName = 'fw_blue.gif';
        break;
      case 'c':
      case 'cyan':
      case 't':
      case 'teal':
        dataPacket.fireworkName = 'fw_cyan.gif';
        break;
      case 'g':
      case 'green':
        dataPacket.fireworkName = 'fw_green.gif';
        break;
      case 'i':
      case 'indigo':
        dataPacket.fireworkName = 'fw_indigo.gif';
        break;
      case 'o':
      case 'orange':
        dataPacket.fireworkName = 'fw_orange.gif';
        break;
      case 'pink':
        dataPacket.fireworkName = 'fw_pink.gif';
        break;
      case 'p':
      case 'purple':
      case 'v':
      case 'violet':
        dataPacket.fireworkName = 'fw_purple.gif';
        break;
      case 'r':
      case 'red':
        dataPacket.fireworkName = 'fw_red.gif';
        break;
      case 'w':
      case 'white':
        dataPacket.fireworkName = 'fw_white.gif';
        break;
      case 'y':
      case 'yellow':
        dataPacket.fireworkName = 'fw_yellow.gif';
        break;
    }
    io.sockets.emit('playFirework', dataPacket);
    fireworkTokens.shift();
    if (fireworkTokens.length > 0) {
      setTimeout(() => { fireFirework(fireworkTokens); }, 500);
    }
  }

  //Channel Point Redemptions
  if (data['custom-reward-id']) {
    //Fireworks - Redemption
    if (data['custom-reward-id'] === 'dcc5a130-23e3-4090-bbbd-e0f10d2b2d94') { //Patiun Channel Only
      if (cleanedTokens.length > 1) {
        if (cleanedTokens.length > 7) {
          cleanedTokens = cleanedTokens.splice(0, 7);
        }
        //console.log("Firework Tokens:",cleanedTokens);
        fireFirework(cleanedTokens);
      } else {
        io.sockets.emit('playFirework', { channel: channel });
      }
    }
  }
}
//#endregion

//#region DB
function query(queryStr) {
  return new Promise((resolve, reject) => {
    if (!connection) {
      reject("No DB connected");
    } else {
      connection.query(queryStr, (error, results, fields) => {
        if (error) reject(error);
        resolve(results);
      });
    }
  });
}

function addUserToDB(username, channel, broadcaster, vip, mod, sub1, sub2, sub3) {
  return new Promise((resolve, reject) => {
    let now = new Date();
    let lastSeen = now.getTime();

    let br = (broadcaster) ? 1 : 0;
    let v = (vip) ? 1 : 0;
    let m = (mod) ? 1 : 0;
    let s1 = (sub1) ? 1 : 0;
    let s2 = (sub2) ? 1 : 0;
    let s3 = (sub3) ? 1 : 0; 6

    query(`SELECT * FROM user WHERE twitchId = '${username}' AND channel = '${channel}'`).then(async result => {
      if (result.length <= 0) {
        //await query(`INSERT INTO user(twitchId,channel,broadcaster,vip,mod,sub1,sub2,sub3,lastSeen) VALUE('${username}','${channel}',${br},${v},${m},${s1},${s2},${s3},${lastSeen});`)
        await query(`
INSERT INTO \`botiun\`.\`user\`
(\`twitchId\`,
\`channel\`,
\`broadcaster\`,
\`vip\`,
\`mod\`,
\`sub1\`,
\`sub2\`,
\`sub3\`,
\`lastSeen\`)
VALUES
('${username}',
  '${channel}',
  ${br},
  ${v},
  ${m},
  ${s1},
  ${s2},
  ${s3},
  ${lastSeen});`)
          .then((result) => {
          })
          .catch((error) => {
          });
        await query(`
          INSERT INTO \`botiun\`.\`currency\`
          (\`twitchId\`,
          \`channel\`)
          VALUES
          ('${username}',
            '${channel}');`)
          .then((result) => {
          })
          .catch((error) => {
          });
      } else {
        await query(`UPDATE \`botiun\`.\`user\` SET lastSeen = ${lastSeen} WHERE twitchId = '${username}' AND channel = '${channel}'`)
          .then((result) => {
            resolve(result);
          })
          .catch((error) => {
            reject(error);
          });
      }
    }).catch(error => {
      console.log(error);
      reject(error);
    });
  });
}
//#endregion