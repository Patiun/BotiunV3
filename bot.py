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
channels = ["rover8680"]

irc = socket.socket()
irc.connect((server, port))
irc.send(f"PASS {token}\n".encode('utf-8'))
irc.send(f"NICK {botName}\n".encode('utf-8'))
irc.send(f"CAP REQ :twitch.tv/membership\n".encode('utf-8'))
irc.send(f"CAP REQ :twitch.tv/tags\n".encode('utf-8'))
irc.send(f"CAP REQ :twitch.tv/commands\n".encode('utf-8'))
for channel in channels:
    irc.send(f"JOIN #{channel}\n".encode('utf-8'))

#Main Loop
while True:
    respSet = irc.recv(2048).decode('utf-8')

    if respSet.startswith('PING'):
        irc.send("PONG\n".encode('utf-8'))
    else:
        #print("New Response Set:")
        #print(respSet)
        #print("---------------------")
        for resp in respSet.split('\n'):
            if resp:
                channel = "[!] Unknown Channel"
                if (resp.find("#") != -1):
                    respChannelTokens = resp.split("#")
                    channel = '#'+respChannelTokens[len(respChannelTokens)-1].strip().split(' ',1)[0]

                if resp.find("JOIN") != -1:
                    print(resp)
                    username = resp.strip().split(':')[1].split('!')[0]
                    print(f"[+] {channel} {username} JOIN EVENT\n")
                elif resp.find("PART") != -1:
                    print(resp)
                    username = resp.strip().split(':')[1].split('!')[0]
                    print(f"[+] {channel} {username} PART EVENT\n")
                elif resp.find("PRIVMSG") != -1:
                    #print(resp.split(' '))
                    tokens = resp.split(' ')
                    userdetailsRaw = tokens[0].lstrip('@').split(';')
                    userdetails = {}
                    for line in userdetailsRaw :
                        keyValue = line.split("=")
                        userdetails[keyValue[0]] = keyValue[1]
                    username = userdetails['display-name']

                    sections = resp.split("PRIVMSG "+channel)
                    message = sections[1].strip().lstrip(':')

                    print(f"[+] {channel} {username} MESSAGE EVENT")
                    print(f"    [-] Message: {message}")
                    print(f"    [-] Badges: {userdetails['badges']}")
                    if (int(userdetails['subscriber']) > 0):
                        print(f"    [!] Subscriber {userdetails['subscriber']}")
                    if (int(userdetails['mod']) > 0):
                        print(f"    [!] Moderator {userdetails['mod']}")
                    #print(f"    [-] Userdetails: {userdetails}\n")
                    print('')
                elif resp.find("ACTION") != -1:
                    print(resp)
                    #username = resp.strip().split(':')[1].split('!')[0];
                    print(f"[+] {channel} {username} ACTION EVENT\n")
                elif resp.find("USERSTATE") != -1:
                    print(f"[+] {channel} USERSTATE EVENT\n")
                elif resp.find("ROOMSTATE") != -1:
                    print(f"[+] {channel} ROOMSTATE EVENT\n")
                else:
                    #print("[!] Unkown Event")
                    #print(resp)
                    #print('\n')
                    pass


#Tools for the job!
#IRC = Chat, Action, Join, Part, Badges and Stuff, (Host/Raid - a notice thing I need to figure out)
#Webhooks = Follow, Sub, Unsub, Go Live, End Stream, Mod Change, Extension tracking
#PubSub = Bits, Bits Badges, Channel Points (Redeem), Subs(Again?), Commerce(Idk what this is), Whispers this user