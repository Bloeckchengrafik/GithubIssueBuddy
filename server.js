require('dotenv').config();
const express = require('express');
const axios = require('axios');
const db = require('./db');

const app = express();
const port = 8081;

app.get('/', (req, res) => {
  res.send('Health check: OK');
});

app.get('/github', async (req, res) => {
  const { code, state } = req.query;
  const userId = state;

  if (!code || !userId) {
    return res.status(400).send('Missing code or state parameter.');
  }

  try {
    const response = await axios.post('https://github.com/login/oauth/access_token', {
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code: code,
    }, {
      headers: {
        'Accept': 'application/json'
      }
    });

    const { access_token } = response.data;

    if (access_token) {
      db.saveToken(userId, access_token);
      res.send('Success! You can close this tab.');
    } else {
      res.status(400).send('Failed to retrieve access token.');
    }
  } catch (error) {
    console.error('Error exchanging code for token:', error);
    res.status(500).send('An error occurred during authentication.');
  }
});

function startServer() {
    app.listen(port, () => {
        console.log(`OAuth server listening at http://localhost:${port}`);
    });
}

module.exports = startServer;
