import { Channel } from "discord.js";
import { Guild } from "discord.js";
import { Snowflake } from "discord.js";
import { Collection } from "discord.js";

export interface Archive {
  local(): string[],
  remote(guild: Guild): Promise<string[]>,
  channels(): Collection<Snowflake, Channel>,
  upload(file: any, guild: Guild): any
}