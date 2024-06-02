const { Webhook, MessageBuilder } = require('discord-webhook-node');

const hook = new Webhook(process.env.WEBHOOK_URL);
const IMAGE_URL = 'https://avatars.githubusercontent.com/u/167089128?s=96&v=4';

hook.setUsername('dotcreator');
hook.setAvatar(IMAGE_URL);

export function sendDiscordMessage(title: string, message: string) {
  const embed = new MessageBuilder()
    .setColor('#FA4545')
    .setTitle(title)
    .setDescription(message)
    .setTimestamp();

  hook.send(embed);
}
