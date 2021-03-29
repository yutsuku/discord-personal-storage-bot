import path from 'path';
import os from 'os';
import * as fs from 'fs';
import colors from 'colors/safe';
import { Archive } from './../interfaces/Archive';
import { Client, DiscordAPIError } from 'discord.js';
import { Channel } from 'discord.js';
import { Collection } from 'discord.js';
import { Snowflake } from 'discord.js';
import { TextChannel } from 'discord.js';
import { Guild } from 'discord.js';
import { GuildChannel } from 'discord.js';
import { MessageAttachment } from 'discord.js';
import { Message } from 'discord.js';
import { ChannelLogsQueryOptions } from 'discord.js';

class ArchiveManager implements Archive {
  protected client: Client;
  public static readonly archiveChannelName = 'archive';
  public static readonly archiveDirectoryName = 'archive';

  constructor(client: Client) {
    this.client = client;
  }

  getArchiveChannel(guild: Guild): TextChannel {
    const channel = guild.channels.cache
      .filter((channel) => channel instanceof TextChannel)
      .find(channel => channel.name.includes(ArchiveManager.archiveChannelName));

    if (!channel) {
      throw new Error('Archive channel not found.');
    }

    return (channel as TextChannel);
  }

  /**
   * Returns a collection of Channels used for archive
   */
  channels(): Collection<Snowflake, Channel> {
    return this.client.channels.cache
      .filter((channel) => channel instanceof TextChannel)
      .filter((channel) => (channel as TextChannel).name
        .toLowerCase().includes(ArchiveManager.archiveChannelName));
  }

  local(): string[] {
    const archivePath = path.join(__dirname, '../../', ArchiveManager.archiveDirectoryName);

    if (fs.existsSync(archivePath)) {
      const files = fs.readdirSync(archivePath, { withFileTypes: true })
        .filter(item => item.isFile())
        .map(item => path.join(__dirname, '../../', ArchiveManager.archiveDirectoryName, '/', item.name));
      return files;
    }

    return [];
  }

  async remoteAttachments(guild: Guild): Promise<Collection<Snowflake, MessageAttachment>> {
    const messages = await this.remoteFetchAll(
      this.getArchiveChannel(guild)
    );
    const attachments = messages.flatMap(
      message => message.attachments
    );

    return attachments;
  }

  async remoteLinks(guild: Guild): Promise<string[]> {
    const attachments = await this.remoteAttachments(guild);
    const links = attachments.map(attachment => attachment.url);

    return links;
  }

  async remote(guild: Guild): Promise<string[]> {
    // im sure there is less ugly way but this works for now
    const attachments = await this.remoteAttachments(guild);
    const files = attachments.map(attachment => attachment.name)
      .flatMap(f => f ? [f] : []);

    return files;
  }

  async remoteFetchAll(channel: TextChannel): Promise<Collection<Snowflake, Message>> {
    let allMessages: Collection<Snowflake, Message> = new Collection();
    let previous = await channel.messages.fetch({ limit: 50 } as ChannelLogsQueryOptions);

    if (previous.first() === undefined) {
      return allMessages;
    }

    previous.each(message => allMessages.set(message.id, message));

    let fetch = true;

    while (fetch) {
      const partial = await channel.messages.fetch(
        { before: previous.last()?.id, limit: 50 } as ChannelLogsQueryOptions
      );
      const lastPartialMessage = partial.last()?.id || null;

      if (lastPartialMessage && allMessages.has(lastPartialMessage)) {
        // reached end of messages
        fetch = false;
      } else {
        previous = partial;
        previous.each(message => allMessages.set(message.id, message));
      }
    }
    return allMessages;
  }

  async upload(file: string, guild: Guild): Promise<Message> {
    const channel = this.getArchiveChannel(guild);
    const filename = path.basename(file);

    const buffer = fs.readFileSync(file);
    const attachment = new MessageAttachment(buffer, filename);

    const message = channel.send(attachment);

    return message;
  }

  async uploadAll(guild: Guild): Promise<Boolean> {
    const remoteFiles = await this.remote(guild);
    const localFiles = this.local();
    const files = localFiles.filter(file => !remoteFiles.includes(path.basename(file)));

    return new Promise(async (resolve) => {
      let success = true;

      for (const file of files) {
        try {
          await this.upload(file, guild);
        } catch (e) {
          success = false;
        }
      };

      resolve(success);
    });
  }

  needChannel(guild: Guild): boolean {
    const readyChannels: Collection<Snowflake, Channel> = this.channels();
    let hasArchiveChannel: GuildChannel | undefined = guild.channels.cache
      .find(channel => readyChannels.has(channel.id));

    return hasArchiveChannel ? false : true;
  }

  /**
   * Returns a Collection of Guilds that are missing archive channel
   */
  needsChannel(): Collection<Snowflake, Guild> {
    let guilds: Collection<Snowflake, Guild> = new Collection();
    const readyChannels: Collection<Snowflake, Channel> = this.channels();

    this.client.guilds.cache.each(guild => {
      let hasArchiveChannel: GuildChannel | undefined = guild.channels.cache
        .find(channel => readyChannels.has(channel.id));

      if (!hasArchiveChannel) {
        guilds.set(guild.id, guild);
      }
    });

    return guilds;
  }

  createArchiveChannel(guild: Guild): Promise<TextChannel> {
    return guild.channels.create(ArchiveManager.archiveChannelName);
  }

  populateChannels(): void {
    const guilds = this.needsChannel();
    guilds.each(guild => {
      guild.channels.create(ArchiveManager.archiveChannelName)
        .catch(e => {
          const error = e as DiscordAPIError;
          if (error.code === 50013) {
            console.error(colors.red(`Missing "MANAGE_CHANNELS" permission in "${guild}".`));
          } else {
            console.error(e);
          }
        });
    });
  }

  async getFileIndex(guild: Guild): Promise<string> {
    const data = await this.remoteLinks(guild);

    return new Promise((resolve, reject) => {
      fs.mkdtemp(path.join(os.tmpdir(), 'dpsb-'), (err, folder) => {
        if (err) {
          reject(err);
        }
        const filepath = path.join(folder, 'list.txt');
        fs.writeFile(filepath, data.join("\n"), err => {
          if (err) {
            reject(err);
          }

          resolve(filepath);
        })
      });
    });
  }
}

export { ArchiveManager as ArchiveManager };