import socket
import re
import colorama
from colorama import Fore, Style


# IRC Details
trackedBadges = ['founder', 'broadcaster', 'bits', 'partner', 'moderator', 'vip',
                 'subscriber', 'premium', 'sub-gift-leader', 'sub-gifter', 'glhf-pledge', 'bits-charity']
unknownBadges = []
server = "irc.chat.twitch.tv"
port = 6667

# Botiun Authentication Stuffs
botName = "Botiun"
token = "oauth:2fsg30d1plxe20drjrb8s3lzwp91l6"
clientId = "95kreu7tyixtgfqd9oe575hjttox0j"

# Target Channels
channels = ["harrisheller"]

def main():
    # Server Details
    irc = socket.socket()
    irc.connect((server, port))
    irc.send(f"PASS {token}\n".encode('utf-8'))
    irc.send(f"NICK {botName}\n".encode('utf-8'))
    irc.send(f"CAP REQ :twitch.tv/membership\n".encode('utf-8'))
    irc.send(f"CAP REQ :twitch.tv/tags\n".encode('utf-8'))
    irc.send(f"CAP REQ :twitch.tv/commands\n".encode('utf-8'))
    for channel in channels:
        irc.send(f"JOIN #{channel}\n".encode('utf-8'))

    lastResp = ''
    # Main Loop
    while True:
        respSet = irc.recv(2048).decode('utf-8')
        file = open(r"output.txt","a")
        file.write(respSet+"|||")
        file.close()

        if respSet.startswith('PING'):
            irc.send("PONG\n".encode('utf-8'))
        else:
            #print("New Response Set:")
            # print(respSet)
            # print("---------------------")
            respList = respSet.strip().split('\n')
            print(f"Last Entry: {respList[len(respList) - 1]}")
            for resp in respList: #TODO Joins and Parts are occaisonally split between 2 responses
                if resp:
                    channel = "[!] Unknown Channel"
                    if (resp.find("#") != -1): 
                        respChannelTokens = resp.split("#")
                        channel = '#' + \
                            respChannelTokens[len(
                                respChannelTokens)-1].strip().split(' ', 1)[0] #TODO This is not always true, if someone uses a #Whaterver it breaks
                    if channel == "[!] Unknown Channel":
                        print(Fore.RED + f'[ERROR] Unable to establish channel.')
                        print(Style.RESET_ALL)# + respSet)
                        break

                    if resp.find("JOIN") != -1:
                        handleIRCUserJoin(channel, resp)
                    elif resp.find("PART") != -1:
                        handleIRCUserPart(channel, resp)
                    elif resp.find("PRIVMSG") != -1:
                        handleIRCMessage(channel, resp)
                    elif resp.find("ACTION") != -1:
                        handleIRCAction(channel, resp)
                    elif resp.find("USERNOTICE") != -1:
                        print(resp)
                        handleIRCUserNotice(channel, resp)
                    elif resp.find("USERSTATE") != -1:
                        #print(f"[+] {channel} USERSTATE EVENT\n")
                        handleIRCUserState(channel, resp)
                    elif resp.find("ROOMSTATE") != -1:
                        #print(f"[+] {channel} ROOMSTATE EVENT\n")
                        handleIRCRoomState(channel, resp)
                    else:
                        print("[!] Unkown Event")
                        print(resp)

        lastResp = respSet

# Tools for the job!
# IRC = Chat, Action, Join, Part, Badges and Stuff, (Host/Raid - a notice thing I need to figure out)
# Webhooks = Follow, Sub, Unsub, Go Live, End Stream, Mod Change, Extension tracking
# PubSub = Bits, Bits Badges, Channel Points (Redeem), Subs(Again?), Commerce(Idk what this is), Whispers this user

def handleIRCMessage(channel, resp):
    global unknownBadges
    global trackedBadges

    try:
        tokens = resp.split(' ')
        userdetailsRaw = tokens[0].lstrip('@').split(';')
        userdetails = {}
        for line in userdetailsRaw:
            keyValue = line.split("=")
            if len(keyValue) > 1:
                userdetails[keyValue[0]] = keyValue[1]
            else:
                userdetails[keyValue[0]] = ''
                print(Fore.RED + f'Key {keyValue[0]} had no value.')
        username = userdetails['display-name']

        sections = resp.split("PRIVMSG "+channel)
        message = sections[1].strip().lstrip(':')

        for badge in trackedBadges:
            userdetails[badge] = '0'
        if (len(userdetails['badges']) > 1):
            for badge in userdetails['badges'].split(','):
                badgeData = badge.split('/')
                if (badgeData[0] in trackedBadges):
                    userdetails[badgeData[0]] = badgeData[1]
                elif (not badgeData[0] in unknownBadges):
                    unknownBadges = unknownBadges + [badgeData[0]]
                    print(
                        f"[!!!] New Badge Found: {badgeData[0]} : {unknownBadges}")

        print(Fore.GREEN + f"[+] {channel} {username} MESSAGE EVENT")
        print(f"    [-] Message: {message}")
        #print(f"    [B] Badges: {userdetails['badges'].split(',')}")
        if (int(userdetails['subscriber']) > 0):
            print(f"    [S] Subscriber {userdetails['subscriber']}")
        if (int(userdetails['founder']) > 0):
            print(f"    [Sf] Founder {userdetails['founder']}")
        if (int(userdetails['mod']) > 0):
            print(f"    [M] Moderator {userdetails['mod']}")
        if (int(userdetails['vip']) > 0):
            print(f"    [V] VIP {userdetails['vip']}")
        if (int(userdetails['bits']) > 0):
            print(f"    [B] Bits {userdetails['bits']}")
        if (int(userdetails['broadcaster']) > 0):
            print(f"    [@] Broadcaster {userdetails['broadcaster']}")
        if (int(userdetails['sub-gifter']) > 0):
            print(f"    [G] Sub-Gifter {userdetails['sub-gifter']}")
        print(Style.RESET_ALL)
    except:
        print(Fore.RED + f'[ERROR] An error occured ')
        print(resp)

def handleIRCUserNotice(channel, resp):
    tokens = resp.split('USERNOTICE')
    detailsRaw = tokens[0].strip()[1:].split(";")
    details = {}
    for line in detailsRaw:
        keyValue = line.split("=")
        details[keyValue[0].strip()] = keyValue[1].strip()
    username = details['display-name']
    message = resp.split("USERNOTICE "+channel)[1].strip().lstrip(':')
    print(Fore.BLUE + f"[+] {channel} {username} USER NOTICE EVENT")
    print(f"    [E] {details['msg-id']}")
    print(f"    [D] {details}")
    if len(message) > 0:
        print(f"    [M] Message: {message}")
    print(Style.RESET_ALL)

def handleIRCUserJoin(channel, resp):
    username = "UNKNOWN"
    usernameArr = resp.strip().split(':')
    if len(usernameArr) > 1:
        username = usernameArr[1].split('!')[0]
        print(Fore.MAGENTA + f"[+] {channel} {username} JOIN EVENT")
        print(Style.RESET_ALL)
    else:
        print(Fore.RED + f"[ERROR] Unable to determine Username in JOIN")
        print(Style.RESET_ALL + resp)

def handleIRCUserPart(channel, resp):
    username = "UNKNOWN"
    usernameArr = resp.strip().split(':')
    if len(usernameArr) > 1:
        username = usernameArr[1].split('!')[0]
        print(Fore.YELLOW + f"[+] {channel} {username} PART EVENT")
        print(Style.RESET_ALL)
    else:
        print(Fore.RED + f"[ERROR] Unable to determine Username in PART")
        print(Style.RESET_ALL + resp)

def handleIRCRoomState(channel, resp):
    pass

def handleIRCUserState(channel, resp):
    pass

def handleIRCAction(channel, resp):
    global unknownBadges
    global trackedBadges

    tokens = resp.split(' ')
    userdetailsRaw = tokens[0].lstrip('@').split(';')
    userdetails = {}
    for line in userdetailsRaw:
        keyValue = line.split("=")
        userdetails[keyValue[0]] = keyValue[1]
    username = userdetails['display-name']

    sections = resp.split("ACTION "+channel)
    message = sections[1].strip().lstrip(':')

    for badge in trackedBadges:
        userdetails[badge] = '0'
    if (len(userdetails['badges']) > 1):
        for badge in userdetails['badges'].split(','):
            badgeData = badge.split('/')
            if (badgeData[0] in trackedBadges):
                userdetails[badgeData[0]] = badgeData[1]
            elif (not badgeData[0] in unknownBadges):
                unknownBadges = unknownBadges + [badgeData[0]]
                print(
                    f"[!!!] New Badge Found: {badgeData[0]} : {unknownBadges}")

    print(Fore.CYAN + f"[+] {channel} {username} ACTION EVENT")
    print(f"    [-] Message: {message}")
    #print(f"    [B] Badges: {userdetails['badges'].split(',')}")
    if (int(userdetails['subscriber']) > 0):
        print(f"    [S] Subscriber {userdetails['subscriber']}")
    if (int(userdetails['founder']) > 0):
        print(f"    [Sf] Founder {userdetails['founder']}")
    if (int(userdetails['mod']) > 0):
        print(f"    [M] Moderator {userdetails['mod']}")
    if (int(userdetails['vip']) > 0):
        print(f"    [V] VIP {userdetails['vip']}")
    if (int(userdetails['bits']) > 0):
        print(f"    [B] Bits {userdetails['bits']}")
    if (int(userdetails['broadcaster']) > 0):
        print(f"    [@] Broadcaster {userdetails['broadcaster']}")
    if (int(userdetails['sub-gifter']) > 0):
        print(f"    [G] Sub-Gifter {userdetails['sub-gifter']}")
    print(Style.RESET_ALL)

if __name__ == "__main__":
    main()