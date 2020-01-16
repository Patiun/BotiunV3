import socket
import re

server = "irc.chat.twitch.tv"
port = 6667
token = "oauth:2fsg30d1plxe20drjrb8s3lzwp91l6"
clientId = "95kreu7tyixtgfqd9oe575hjttox0j"
channels = ["patiun"]
botName = "Botiun"
adminName = "Patiun"

irc = socket.socket()
irc.connect((server, port))
irc.send(f"PASS {token}\n".encode('utf-8'))
irc.send(f"NICK {botName}\n".encode('utf-8'))
irc.send(f"CAP REQ :twitch.tv/membership\n".encode('utf-8'))
irc.send(f"CAP REQ :twitch.tv/tags\n".encode('utf-8'))
irc.send(f"CAP REQ :twitch.tv/commands\n".encode('utf-8'))
for channel in channels:
    irc.send(f"JOIN #{channel}\n".encode('utf-8'))

while True:
    resp = irc.recv(2048).decode('utf-8')

    if resp.startswith('PING'):
        irc.send("PONG\n".encode('utf-8'))

    tokens = resp.split(':')
    if (len(tokens) > 2 and tokens[2]):
        irc.send(f":tmi.twitch.tv USERNOTICE #patiun :message")

    print(resp)

#Tools for the job!
#IRC = Chat, Join, Part, Badges and Stuff, (Host/Raid - a notice thing I need to figure out)
#Webhooks = Follow, Sub, Unsub, Go Live, End Stream, Mod Change, Extension tracking
#PubSub = Bits, Bits Badges, Channel Points (Redeem), Subs(Again?), Commerce(Idk what this is), Whispers this user