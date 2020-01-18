import socket
import re
import colorama
from colorama import Fore, Style


# IRC Details
trackedBadges = ['founder', 'broadcaster', 'bits', 'bits-leader', 'partner', 'moderator', 'vip',
                 'subscriber', 'premium', 'sub-gift-leader', 'sub-gifter', 'glhf-pledge', 'bits-charity']
unknownBadges = []
server = "irc.chat.twitch.tv"
port = 6667

# Botiun Authentication Stuffs
botName = "Botiun"
token = "oauth:2fsg30d1plxe20drjrb8s3lzwp91l6"
clientId = "95kreu7tyixtgfqd9oe575hjttox0j"

# Target Channels
channels = ["lilypichu"]

def main():
    # Connect to IRC Server
    irc = socket.socket()
    irc.connect((server, port))
    irc.send(f"PASS {token}\n".encode('utf-8'))
    irc.send(f"NICK {botName}\n".encode('utf-8'))
    irc.send(f"CAP REQ :twitch.tv/membership\n".encode('utf-8'))
    irc.send(f"CAP REQ :twitch.tv/tags\n".encode('utf-8'))
    irc.send(f"CAP REQ :twitch.tv/commands\n".encode('utf-8'))
    for channel in channels:
        irc.send(f"JOIN #{channel.lower()}\n".encode('utf-8'))

    runningResp = ''
    # Main Loop
    while True:
        respSet = irc.recv(2048).decode('utf-8')
        runningResp += respSet
        if (respSet[-1:] != '\n'):
            #print("Waiting...")
            pass
        else:
            '''
            file = open(r"output.txt","a")
            try:
                file.write(respSet)
            except:
                print("[ERROR] Error writing to file")
                #print(respSet)
            file.close()
            '''

            #TODO Get all current users from NAMES event end on /NAMES

            if runningResp.startswith('PING'):
                irc.send("PONG\n".encode('utf-8'))
            else:
                #print("New Response Set:")
                # print(respSet)
                # print("---------------------")
                respList = runningResp.strip().split('\n')
                #print(f"Last Entry: {respList[len(respList) - 1]}")
                for resp in respList:
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
                        #print(channel)

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
                        elif resp.find("CLEARMSG") != -1:
                            #TODO Message deleted by Mod login=USERNAME msg= message paylod
                            handleIRCClearMesage(channel, resp)
                        elif resp.find("CLEARCHAT") != -1:
                            #TODO Chat cleared and user banned username = message payload
                            handleIRCClearChat(channel,resp)
                        else:
                            print("[!] Unkown Event")
                            print(resp)
            runningResp = ''

# Tools for the job!
# IRC = Chat, Action, Join, Part, Badges and Stuff, (Host/Raid - a notice thing I need to figure out)
# Webhooks = Follow, Sub, Unsub, Go Live, End Stream, Mod Change, Extension tracking
# PubSub = Bits, Bits Badges, Channel Points (Redeem), Subs(Again?), Commerce(Idk what this is), Whispers this user

#INCOMING IRC Handlers
def handleIRCMessage(channel, resp):
    global unknownBadges
    global trackedBadges

    try:
        groups = re.search(r'^@[^\s]+',resp)
        userdetails = parseTagString(groups.group(0).strip()[1:])
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
                    print(f"[!!!] New Badge Found: {badgeData[0]} : {unknownBadges}")

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
        #print(Fore.MAGENTA + f"[+] {channel} {username} JOIN EVENT")
        #print(Style.RESET_ALL)
    else:
        print(Fore.RED + f"[ERROR] Unable to determine Username in JOIN")
        print(Style.RESET_ALL + resp)

#TODO UNHANDLED
def handleIRCUserPart(channel, resp):
    username = "UNKNOWN"
    usernameArr = resp.strip().split(':')
    if len(usernameArr) > 1:
        username = usernameArr[1].split('!')[0]
        #print(Fore.YELLOW + f"[+] {channel} {username} PART EVENT")
        #print(Style.RESET_ALL)
    else:
        print(Fore.RED + f"[ERROR] Unable to determine Username in PART")
        print(Style.RESET_ALL + resp)

#TODO UNHANDLED
def handleIRCRoomState(channel, resp):
    pass

def handleIRCUserState(channel, resp):
    pass

def handleIRCClearMesage(channel, resp):
    groups = re.search(r'^@[^\s]+',resp)
    detailsRaw = groups.group(0)[1:].split(';')
    details = {}
    for detail in detailsRaw:
        keyValue = detail.split('=')
        if len(keyValue) > 1:
            details[keyValue[0]] = keyValue[1]
        else:
            details[keyValue[0]] = ''

    tokens = resp.split(channel)
    message = tokens[1].strip()[1:]

    print(Fore.LIGHTRED_EX + f"[MESSAGE CLEAR] Deleted {details['login']}'s \"{message}\"")
    print(Style.RESET_ALL)

def handleIRCClearChat(channel, resp):
    groups = re.search(r'^@[^\s]+',resp)
    detailsRaw = groups.group(0)[1:].split(';')
    details = {}
    for detail in detailsRaw:
        keyValue = detail.split('=')
        if len(keyValue) > 1:
            details[keyValue[0]] = keyValue[1]
        else:
            details[keyValue[0]] = ''

    tokens = resp.split(channel)
    message = tokens[1].strip()[1:]

    print(Fore.LIGHTRED_EX + f"[USER BANNED] {message} for {details['ban-duration']}s Details: {details}")
    print(Style.RESET_ALL)

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

#Helper Functions
#Returns a dictionary of tags to values
def parseTagString(tagString):
    details = {}
    tagPairs = tagString.split(';')
    for keyValPair in tagPairs:
        keyValSet = keyValPair.split('=')
        if (len(keyValSet) > 1):
            details[keyValSet[0]] = keyValSet[1]
        else:
            details[keyValSet[0]] = ''
    return details

if __name__ == "__main__":
    main()