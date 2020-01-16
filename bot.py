import socket
import re

#Server Details
server = "irc.chat.twitch.tv"
port = 6667

#Botiun Authentication Stuffs
botName = "Botiun"
token = "oauth:2fsg30d1plxe20drjrb8s3lzwp91l6"
clientId = "95kreu7tyixtgfqd9oe575hjttox0j"

#Target Channels
channels = ["patiun"]

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
    respSet = irc.recv(2048).decode('utf-8')

    if respSet.startswith('PING'):
        irc.send("PONG\n".encode('utf-8'))
    else:
        print("New Response Set:")
        print(respSet)
        print("---------------------")
        for resp in respSet.split('\n'):
            if resp:
                print("+")
                print(resp)
                eventType = 
        print('\n')


#Tools for the job!
#IRC = Chat, Action, Join, Part, Badges and Stuff, (Host/Raid - a notice thing I need to figure out)
#Webhooks = Follow, Sub, Unsub, Go Live, End Stream, Mod Change, Extension tracking
#PubSub = Bits, Bits Badges, Channel Points (Redeem), Subs(Again?), Commerce(Idk what this is), Whispers this user