import { Client, Message, TextChannel } from "discord.js";
import * as path from 'path';
import * as fs from 'fs';
import { ArchiveManager } from "../components/ArchiveManager";
import { Guild } from "discord.js";
import { MessageAttachment } from "discord.js";

module.exports = {
  name: 'archive',
  description: 'Manages archive data and related Discord guilds',
  async execute(client: Client, message: Message, args: any) {
    if (args[0] === 'list') {
      if (args[1] === 'guilds') {
        const guilds = client.channels.cache
          .filter((channel) => channel instanceof TextChannel)
          .filter((channel) => (channel as TextChannel).name.toLowerCase().includes('archive'))
          .map(channel => (channel as TextChannel).guild.name)
          .join('\n');
        message.reply(guilds.trim().length > 0 ? guilds : 'none');
      }

      if (args[1] === 'files' && args[2] === 'local') {
        let handled = false;
        const manager = new ArchiveManager(client);
        const files = manager.local()
          .flatMap(filepath => path.basename(filepath));

        if (files.length > 0) {
          handled = true;

          if (files.length > 50) {
            const filesLimited = files.slice(1, 50);
            message.reply('\n```\n' + filesLimited.join('\n') + '\n```\n'
              + `Skipped ${files.length - filesLimited.length} file(s)`);
          } else {
            message.reply('\n```\n' + files.join('\n') + '\n```');
          }
        }

        if (!handled) {
          message.reply('no files');
        }
      }

      if (args[1] === 'files' && args[2] === 'remote') {
        try {
          message.reply('on it');

          const manager = new ArchiveManager(client);
          let handled = false;

          // we're handling only guild messages anyway
          const files = await manager.remote(message.guild as Guild);

          if (files.length > 0) {
            handled = true;

            if (files.length > 50) {
              const filesLimited = files.slice(1, 50);
              message.reply('\n```\n' + filesLimited.join('\n') + '\n```\n'
                + `Skipped ${files.length - filesLimited.length} file(s)`);
            } else {
              message.reply('\n```\n' + files.join('\n') + '\n```');
            }
          }

          if (!handled) {
            message.reply('no files');
          }
        } catch (e) {
          message.reply('something went wrong');
        }

      }
    }

    if (args[0] === 'upload') {
      try {
        message.reply('on it');

        const manager = new ArchiveManager(client);
        const status = await manager.uploadAll(message.guild as Guild);

        message.reply(`done, ${status ? "all good" : "but something wen't wrong, check files manually"}`);
      } catch (e) {
        message.reply('something went wrong');
      }
    }

    if (args[0] === 'index') {
      
      try {
        message.reply('on it');
        const manager = new ArchiveManager(client);

        const filename = await manager.getFileIndex(message.guild as Guild);
        const buffer = fs.readFileSync(filename);
        const attachment = new MessageAttachment(buffer, path.basename(filename));

        message.reply(attachment);
      } catch (e) {
        message.reply('something went wrong');
      }
    }
  },
};
