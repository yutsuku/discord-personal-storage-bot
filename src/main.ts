import { Client, Collection, Command } from 'discord.js';
import * as fs from 'fs';
import * as path from 'path';
import { ArchiveManager } from './components/ArchiveManager';

const client: Client = new Client();
const archiveManager = new ArchiveManager(client);
client.commands = new Collection();

const commandFiles = fs.readdirSync(path.join(__dirname, "commands"))
  .filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(path.join(__dirname, "commands") + `/${file}`);
  client.commands.set(command.name, command);
}

client.on('ready', () => {
  console.log(`Logged in as ${client?.user?.tag}!`);
  archiveManager.populateChannels();
});

client.on('message', async msg => {
  if (msg.author.bot) return;
  if (msg.channel.type !== 'text') return;

  const args: string[] = msg.content.trim().split(/ +/);
  const commandName: string = (args.shift() ?? '').toLowerCase();

  if (!client.commands.has(commandName)) return;

  const command: Command | undefined = client.commands.get(commandName);

  try {
    command?.execute(client, msg, args);
  } catch (error) {
    console.error(error);
    msg.reply('there was an error trying to execute that command!');
  }
});

client.login(process.env.token);