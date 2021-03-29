# DPSB - Discord Personal Storage Bot
Simple bot for uploading files to discord

## Getting Started
These instructions will get you a copy of the project up and running on your
local machine for development and testing purposes. See deployment for notes on 
how to deploy the project on a live system.

### Prerequisites
* You will need to create `New Application` in 
[Discord Developer Portal](https://discord.com/developers/applications)
* From the left Settings pane, go to `Bot` and select `Add Bot`
* Get your bot token by selecting `Click to Reveal Token`, save it for later use
* From the left Settings pane, go to `OAuth2` and from the `Scopes` table tick
the `bot` checkbox
* Copy generated link below all checkboxes, navigate to it to add the Bot to 
your Discord Server/Guild

* Create new text channel named `archive`

OR

* Grant `Manage Channels` permission to your bot using `Roles`

### Installation
* Get [Docker](https://www.docker.com/)
* Copy `.env.example` as `.env`
* Fill the bot token value in `.env` file obtained previously from 
[Discord Developer Portal](https://discord.com/developers/applications)

## Deployment
* Create `archive` directory in same place as application and place any files 
you wish to upload here
* Run the following command

```
docker-compose up -d
```

It will start new container named `discord-personal-storage-bot` in de-attached 
mode.
For more details refer to
[Docker docs](https://docs.docker.com/compose/reference/up/).

## Discord chat commands
* `archive list guilds`
shows names of which Discord Servers/Guilds the bot serves
* `archive list files local`
list local files
* `archive list files remote`
list remote files in current Discord Server/Guild
* `archive upload`
uploads local files to all connected Discord Servers/Guilds
* `archive index`
generates new file with all links in `archive` channel


### Common questions and issues
* Q: What files can I upload?
* A: This bot will upload any file as long as Discord allows it, keep in mind
file limits (around 8MiB as of 2021). For best experience use multi part archive
with password.

* Q: Why my files are stripped of original name or other characters?
* A: Incomplete Discord API, nothing can be done about it at this moment.
See https://github.com/discord/discord-api-docs/issues/2102 for details

* Q: How do I download files uploaded by bot on another machine?
* A: See `extras/download.ps1` for Windows users, you will need to adjust it to
fit your needs
