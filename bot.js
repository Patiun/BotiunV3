//Botiun Authentication Stuffs
const botName = "Botiun";
const token = "oauth:2fsg30d1plxe20drjrb8s3lzwp91l6";
const clientId = "95kreu7tyixtgfqd9oe575hjttox0j";

//Badge Details
const trackedBadges = ['founder', 'broadcaster', 'bits', 'bits-leader', 'partner', 'moderator', 'vip',
    'subscriber', 'premium', 'sub-gift-leader', 'sub-gifter', 'glhf-pledge', 'bits-charity'
];
let unknownBadges = [];

//Server Details
const serverIRC = "irc://irc.chat.twitch.tv";
const portIRC = 6667;
const serverWS = "ws://irc-ws.chat.twitch.tv";
const portWS = 80;

//Target Channels
let channels = ["itssliker", "patiun", "warrkilm"];

//current users
let ignoredUsers = ["botiun", "streamelements", "streamlabs", "nightbot"];
let users = {};

const WebSocket = require('ws');

const irc = new WebSocket(`${serverWS}:${portWS}`);

irc.on('open', function open() {
    irc.send(`PASS ${token}`);
    irc.send(`NICK ${botName.toLowerCase()}`);
    irc.send(`CAP REQ :twitch.tv/membership`);
    irc.send(`CAP REQ :twitch.tv/tags`);
    irc.send(`CAP REQ :twitch.tv/commands`);
    for (let channel of channels) {
        irc.send(`JOIN #${channel.toLowerCase()}`);
        users[channel] = [];
    }
});

irc.on('message', function incoming(data) {
    processIncomingData(data);
});

async function processIncomingData(data) {
    let pingCheck = data.substring(0, 4);
    if (pingCheck === "PING") {
        irc.send("PONG :tmi.twitch.tv");
        return;
    }
    let events = data.split('\n');
    for (let eventData of events) {
        if (eventData) {
            let timeStamp = (new Date()).getTime();
            //console.log(timeStamp + " --> " + data);
            const { event, channel, username, metadata, payload } = parseEventData(eventData);
            if (ignoredUsers.includes(username)) {
                continue;
            }
            switch (event) {
                case "PRIVMSG":
                    //console.log("%c[!!!] " + event + " " + timeStamp, 'color: #bada55');
                    //console.log(channel, username, payload, metadata);
                    break;
                case "JOIN":
                    console.log("%c[" + event + "] " + username + " joined #" + channel + " at " + timeStamp, 'color: #00ff00');
                    break;
                case "PART":
                    console.log("%c[" + event + "] " + username + " parted #" + channel + " at " + timeStamp, 'color: #660066');
                    break;
                case "USERSTATE":
                    console.log("%c[!!!] " + event + " " + timeStamp, 'color: #aaa');
                    console.log(channel, username, payload, metadata);
                    break;
                case "USERNOTICE":
                    console.log("%c[!!!] " + event + " " + timeStamp, 'color: #aaa');
                    console.log(channel, username, payload, metadata);
                    break;
                case "ROOMSTATE":
                    console.log("%c[!!!] " + event + " " + timeStamp, 'color: #aaa');
                    console.log(channel, username, payload, metadata);
                    break;
                case "CLEARCHAT":
                    console.log("%c[!!!] " + event + " " + timeStamp, 'color: #ff0000');
                    console.log(channel, username, payload, metadata);
                    //payload === the banned user
                    break;
                case "HOSTTARGET":
                    console.log("%c[!!!] " + event + " " + timeStamp, 'color: #aaa');
                    console.log(channel, username, payload, metadata);
                    break;
                case "NOTICE":
                    console.log("%c[!!!] " + event + " " + timeStamp, 'color: #aaa');
                    console.log(channel, username, payload, metadata);
                    break;
                case "*":
                case botName.toLowerCase():
                    //Ignore these
                    break;
                default:
                    console.log("[!!!] Unknown Event: " + event);
                    console.log(eventData);
                    break;
            }
        }
    }
}

function parseEventData(data) {
    let tokens = data.split(' ');
    let length = tokens.length;
    let start = tokens.splice(0, 4);

    let event = "{NE}";
    let metadata = {};
    let channel = "{NC}";
    let username = "{NU}";
    let payload = "{NP}";
    try {
        if (length <= 3) {
            username = start[0].substring(1, start[0].length);
            username = username.split('!')[0];
            event = start[1];
            channel = start[2].substring(1, start[2].length);
            payload = username;
        } else {
            metadata = start[0];
            username = start[1].substring(1, start[1].length);
            username = username.split('!')[0];
            event = start[2];
            channel = start[3].substring(1, start[3].length);
            payload = tokens.join(' ');
            payload = payload.substring(1, payload.length);
            //Parse metadata
            metadata = metadata.substring(1, metadata.length);
            metadataTokens = metadata.split(';');
            metaObj = {};
            for (let token of metadataTokens) {
                let tokenData = token.split('=');
                metaObj[tokenData[0]] = (tokenData.length > 1) ? tokenData[1] : '';
            }
            metadata = metaObj;
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
        payload: payload
    };
}