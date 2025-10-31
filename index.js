require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  InteractionType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const db = require("./db");
const github = require("./github");
const startServer = require("./server");

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const issueCreationCache = new Map();

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}!`);
  startServer();
});

client.on("interactionCreate", async (interaction) => {
  // Command: /github-link
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === "github-link") {
      const authUrl = `https://github.com/login/oauth/authorize?client_id=${process.env.GITHUB_CLIENT_ID}&redirect_uri=${process.env.GITHUB_REDIRECT}&scope=repo,project&state=${interaction.user.id}`;
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel("Link GitHub Account")
          .setStyle(ButtonStyle.Link)
          .setURL(authUrl),
      );
      await interaction.reply({
        content: "Click the button below to link your GitHub account.",
        components: [row],
        ephemeral: true,
      });
    }
  }
  // Context Menu: Create GitHub Issue
  else if (interaction.isMessageContextMenuCommand()) {
    if (interaction.commandName === "Create GitHub Issue") {
      if (!db.getToken(interaction.user.id)) {
        return interaction.reply({
          content:
            "Please link your GitHub account first using `/github-link`.",
          ephemeral: true,
        });
      }
      const originalMessage = interaction.targetMessage;
      issueCreationCache.set(interaction.user.id, {
        content: originalMessage.content,
        author: originalMessage.author,
        messageId: originalMessage.id,
        channelId: interaction.channelId,
        guildId: interaction.guildId,
      });

      const modal = new ModalBuilder()
        .setCustomId("create-issue-modal")
        .setTitle("Create New GitHub Issue");
      const titleInput = new TextInputBuilder()
        .setCustomId("issue-title")
        .setLabel("Issue Title")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);
      const descriptionInput = new TextInputBuilder()
        .setCustomId("issue-description")
        .setLabel("Additional Description (Optional)")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false);
      modal.addComponents(
        new ActionRowBuilder().addComponents(titleInput),
        new ActionRowBuilder().addComponents(descriptionInput),
      );
      await interaction.showModal(modal);
    }
  }
  // Modal Submission
  else if (interaction.type === InteractionType.ModalSubmit) {
    if (interaction.customId === "create-issue-modal") {
      const cachedData = issueCreationCache.get(interaction.user.id);
      if (!cachedData)
        return interaction.reply({
          content: "Error: Could not find issue data. Please try again.",
          ephemeral: true,
        });

      cachedData.title = interaction.fields.getTextInputValue("issue-title");
      cachedData.additionalDescription =
        interaction.fields.getTextInputValue("issue-description");
      issueCreationCache.set(interaction.user.id, cachedData);

      const statusChoices = process.env.GITHUB_PROJECT_GROUP_CHOICES.split(
        ",",
      ).map((choice) => ({
        label: choice.split(":")[0],
        value: choice.split(":")[1],
      }));
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId("issue-status-select")
        .setPlaceholder("Select a status")
        .addOptions(statusChoices);
      const row = new ActionRowBuilder().addComponents(selectMenu);
      await interaction.reply({
        content: "Please select a status for the new issue.",
        components: [row],
        ephemeral: true,
      });
    }
  }
  // Select Menu for Status
  else if (interaction.isStringSelectMenu()) {
    if (interaction.customId === "issue-status-select") {
      await interaction.deferReply({ ephemeral: true });
      const issueData = issueCreationCache.get(interaction.user.id);
      if (!issueData)
        return interaction.editReply({
          content: "Error: Could not find issue data. Please try again.",
        });

      const {
        title,
        content,
        additionalDescription,
        author,
        messageId,
        channelId,
        guildId,
      } = issueData;
      const statusNodeId = interaction.values[0];
      const token = db.getToken(interaction.user.id);

      let issueDetails;
      try {
        const messageUrl = guildId
          ? `https://discord.com/channels/${guildId}/${channelId}/${messageId}`
          : `https://discord.com/channels/@me/${channelId}/${messageId}`;
        let body = `${content}\n\n> Original Message: ${messageUrl} by ${author.displayName}`;
        if (additionalDescription)
          body += `\n\n---\n\n${additionalDescription}`;
        body += `\n\n— Created via GitHub Issue Buddy`;
        issueDetails = await github.createIssue(token, title, body);
      } catch (error) {
        console.error("Failed to create issue:", error);
        return interaction.editReply({
          content: "❌ An error occurred while creating the GitHub issue.",
        });
      }

      try {
        await github.addIssueToProject(
          token,
          issueDetails.node_id,
          statusNodeId,
        );
        await interaction.editReply({
          content: `✅ Issue created and added to project!\n${issueDetails.html_url}`,
        });
      } catch (error) {
        console.error("Failed to add issue to project:", error);
        const retryButton = new ButtonBuilder()
          .setCustomId(
            `retry-add-project:${issueDetails.node_id}:${statusNodeId}`,
          )
          .setLabel("Retry")
          .setStyle(ButtonStyle.Primary);
        const row = new ActionRowBuilder().addComponents(retryButton);
        await interaction.editReply({
          content: `✅ Issue created, but failed to add to project. You may need to grant the
 project
 scope by re-linking your account.\n${issueDetails.html_url}`,
          components: [row],
        });
      } finally {
        issueCreationCache.delete(interaction.user.id);
      }
    }
  }
  // Button Press for Retry
  else if (interaction.isButton()) {
    if (interaction.customId.startsWith("retry-add-project:")) {
      await interaction.deferReply({ ephemeral: true });
      const [, issueNodeId, statusNodeId] = interaction.customId.split(":");
      const token = db.getToken(interaction.user.id);

      try {
        await github.addIssueToProject(token, issueNodeId, statusNodeId);
        await interaction.editReply({
          content: "✅ Successfully added issue to project!",
          components: [],
        });
      } catch (error) {
        console.error("Retry failed:", error);
        await interaction.editReply({
          content:
            "❌ Retry failed. Please ensure you have granted the project scope and try again.",
        });
      }
    }
  }
});

client.login(process.env.DISCORD_BOT_TOKEN);
