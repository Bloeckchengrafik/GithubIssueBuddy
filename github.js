require("dotenv").config();
const { Octokit } = require("@octokit/rest");
const { graphql } = require("@octokit/graphql");

async function createIssue(token, title, body) {
  const octokit = new Octokit({ auth: token });
  const [owner, repo] = process.env.GITHUB_ISSUE_REPO.split("/");

  const response = await octokit.rest.issues.create({
    owner,
    repo,
    title,
    body,
  });

  return {
    node_id: response.data.node_id,
    html_url: response.data.html_url,
  };
}

async function addIssueToProject(token, issueNodeId, statusNodeId) {
  const graphqlWithAuth = graphql.defaults({
    headers: {
      authorization: `token ${token}`,
    },
  });

  // Step 1: Add the issue to the project
  const addMutation = `
        mutation($projectId: ID!, $contentId: ID!) {
            addProjectV2ItemById(input: {projectId: $projectId, contentId: $contentId}) {
                item {
                    id
                }
            }
        }
    `;

  const addResult = await graphqlWithAuth(addMutation, {
    projectId: process.env.GITHUB_PROJECT_GLOBAL_ID,
    contentId: issueNodeId,
  });

  const projectItemId = addResult.addProjectV2ItemById.item.id;

  // Step 2: Set the status of the new project item
  const updateMutation = `
        mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
            updateProjectV2ItemFieldValue(input: {
                projectId: $projectId,
                itemId: $itemId,
                fieldId: $fieldId,
                value: { singleSelectOptionId: $optionId }
            }) {
                projectV2Item {
                    id
                }
            }
        }
    `;

  await graphqlWithAuth(updateMutation, {
    projectId: process.env.GITHUB_PROJECT_GLOBAL_ID,
    itemId: projectItemId,
    fieldId: process.env.GITHUB_PROJECT_STATUS_FIELD_ID,
    optionId: statusNodeId,
  });

  return true;
}

module.exports = { createIssue, addIssueToProject };
