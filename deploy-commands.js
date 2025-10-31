require("dotenv").config();
const { REST, Routes, ApplicationCommandType } = require("discord.js");

const commands = [
  {
    name: "github-link",
    description: "Link your GitHub account to create issues.",
    integration_types: [0, 1], // 0 for Guild Install, 1 for User Install
    contexts: [0, 1, 2], // 0 for Guild, 1 for Bot DM, 2 for Private Channel
  },
  {
    name: "Create GitHub Issue",
    type: ApplicationCommandType.Message,
    integration_types: [0, 1],
    contexts: [0, 1, 2],
  },
];

const rest = new REST({ version: "10" }).setToken(
  process.env.DISCORD_BOT_TOKEN,
);

(async () => {
  try {
    console.log("Started refreshing application (/) commands.");

    await rest.put(Routes.applicationCommands(process.env.DISCORD_APP_ID), {
      body: commands,
    });

    console.log("Successfully reloaded application (/) commands.");
  } catch (error) {
    console.error(error);
  }
})();
