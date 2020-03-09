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
channels = ["invadervie","patiun", "warrkilm"]

#current users
ignoredUsers = ["botiun","streamelements","streamlabs","nightbot"]
users = {}

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
        users[channel] = []

    runningResp = ''
    # Main Loop
    while True:
        respSet = irc.recv(2048).decode('utf-8')
        runningResp += respSet
        if (respSet[-1:] != '\n'):
            # print("Waiting...")
            pass
        else:

            '''file = open(r"output.txt","a")
            try:
                file.write(respSet)
            except:
                print("[ERROR] Error writing to file\n")
                #print(respSet)
            file.close()'''

            # TODO Get all current users from NAMES event end on /NAMES

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
                            respSpaceSplit = resp.split(' ')
                            for piece in respSpaceSplit:
                                tempChannel = piece.strip()[1:].lower()
                                if tempChannel in channels:
                                    channel = '#'+tempChannel  # Channel has #
                                    break
                        if channel == "[!] Unknown Channel":
                            print(
                                Fore.RED + f'[ERROR] Unable to establish channel.')
                            print(Style.RESET_ALL)  # + respSet)
                            break
                        # print(channel)

                        if resp.find("JOIN") != -1:
                            handleIRCUserJoin(channel, resp)
                        elif resp.find("PART") != -1:
                            handleIRCUserPart(channel, resp)
                        elif resp.find("PRIVMSG") != -1:
                            handleIRCMessage(channel, resp)
                        elif resp.find("ACTION") != -1:
                            handleIRCAction(channel, resp)
                        elif resp.find("USERNOTICE") != -1:
                            # print(resp)
                            handleIRCUserNotice(channel, resp)
                        elif resp.find("USERSTATE") != -1:
                            handleIRCUserState(channel, resp)
                        elif resp.find("ROOMSTATE") != -1:
                            handleIRCRoomState(channel, resp)
                        elif resp.find("CLEARMSG") != -1:
                            handleIRCClearMesage(channel, resp)
                        elif resp.find("CLEARCHAT") != -1:
                            handleIRCClearChat(channel, resp)
                        elif resp.find("NOTICE") != -1:
                            print('[+] NOTICE EVENT')
                            print(resp)
                            print()
                        elif resp.find("HOSTTARGET") != -1:
                            ':tmi.twitch.tv HOSTTARGET #patiun :poorlyplayedgames 7 '
                            print("[+] HOSTING ANOTHER STREAM")
                            print(resp)
                            print()
                        else:
                            print("[!] Unkown Event")
                            print(resp)
                            print()
            runningResp = ''

# Tools for the job!
# IRC = Chat, Action, Join, Part, Badges and Stuff, (Host/Raid - a notice thing I need to figure out)
# Webhooks = Follow, Sub, Unsub, Go Live, End Stream, Mod Change, Extension tracking
# PubSub = Bits, Bits Badges, Channel Points (Redeem), Subs(Again?), Commerce(Idk what this is), Whispers this user

# INCOMING IRC Handlers
def handleIRCMessage(channel, resp):
    global unknownBadges
    global trackedBadges

    try:
        groups = re.search(r'^@[^\s]+', resp)
        userdetails = parseTagString(groups.group(0).strip()[1:])

        username = userdetails['display-name']
        if username.lower() in ignoredUsers:
            return

        sections = resp.split("PRIVMSG "+channel)
        message = sections[1].strip().lstrip(':')

        printMessageToConsole(channel, username, userdetails, message)
    except:
        print(Fore.RED + f'[ERROR] An error occured ')
        print(resp)
        print(Style.RESET_ALL)

def handleIRCAction(channel, resp):
    global unknownBadges
    global trackedBadges

    try:
        groups = re.search(r'^@[^\s]+', resp)
        userdetails = parseTagString(groups.group(0).strip()[1:])

        username = userdetails['display-name']
        if username.lower() in ignoredUsers:
            return

        sections = resp.split("ACTION "+channel)
        message = sections[1].strip().lstrip(':')

        printActionToConsole(channel, username, userdetails, message)
    except:
        print(Fore.RED + f'[ERROR] An error occured ')
        print(resp)
        print(Style.RESET_ALL)


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
        if username.lower() in ignoredUsers:
            return
        if not username in users[channel[1:]]:
            print(Fore.MAGENTA + f"[+] {channel} {username} JOIN EVENT")
            print(Style.RESET_ALL)
            users[channel[1:]].append(username)
    else:
        print(Fore.RED + f"[ERROR] Unable to determine Username in JOIN")
        print(Style.RESET_ALL + resp)


def handleIRCUserPart(channel, resp):
    username = "UNKNOWN"
    usernameArr = resp.strip().split(':')
    if len(usernameArr) > 1:
        username = usernameArr[1].split('!')[0]
        if username.lower() in ignoredUsers:
            return
        if username in users[channel[1:]]:
            print(Fore.YELLOW + f"[+] {channel} {username} PART EVENT")
            print(Style.RESET_ALL)
            users[channel[1:]].remove(username)
    else:
        print(Fore.RED + f"[ERROR] Unable to determine Username in PART")
        print(Style.RESET_ALL + resp)


def handleIRCRoomState(channel, resp):
    print(f"[+] {channel} ROOMSTATE EVENT")
    print(resp)
    print()


def handleIRCUserState(channel, resp):
    print(f"[+] {channel} USERSTATE EVENT")
    print(resp)
    print()


def handleIRCClearMesage(channel, resp):
    groups = re.search(r'^@[^\s]+', resp)
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

    print(Fore.LIGHTRED_EX +
          f"[MESSAGE CLEAR] Deleted {details['login']}'s \"{message}\"")
    print(Style.RESET_ALL)


def handleIRCClearChat(channel, resp):
    groups = re.search(r'^@[^\s]+', resp)
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
    if 'ban-duration' in details.keys():
        print(Fore.LIGHTRED_EX +
              f"[USER BANNED] {message} for {details['ban-duration']}s Details: {details}")
    else:
        print(Fore.LIGHTRED_EX +
              f"[USER BANNED] {message} banned forever Details: {details}")
    print(Style.RESET_ALL)


# Helper Functions
# Returns a dictionary of tags to values

def parseTagString(tagString):
    global unknownBadges
    global trackedBadges

    details = {}
    tagPairs = tagString.split(';')
    for keyValPair in tagPairs:
        keyValSet = keyValPair.split('=')
        if (len(keyValSet) > 1):
            details[keyValSet[0]] = keyValSet[1]
        else:
            details[keyValSet[0]] = ''

    for badge in trackedBadges:
        details[badge] = '0'
        if (len(details['badges']) > 1):
            for badge in details['badges'].split(','):
                badgeData = badge.split('/')
                if (badgeData[0] in trackedBadges):
                    details[badgeData[0]] = badgeData[1]
                elif (not badgeData[0] in unknownBadges):
                    unknownBadges = unknownBadges + [badgeData[0]]
                    print(f"[!!!] New Badge Found: {badgeData[0]} : {unknownBadges}")

    return details

def printMessageToConsole(channel, username, userdetails, message):
    print(Fore.GREEN + f"[+] {channel} {username} MESSAGE EVENT")
    print(f"    [-] Message: {message}")
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

def printActionToConsole(channel, username, userdetails, message):
    print(Fore.GREEN + f"[+] {channel} {username} ACTION EVENT")
    print(f"    [-] Action: {message}")
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
