const fs = require("fs");
const path = require("path");

const dbPath = path.join(__dirname, "db.json");

function readDb() {
  try {
    if (fs.existsSync(dbPath)) {
      const data = fs.readFileSync(dbPath, "utf8");
      return JSON.parse(data);
    }
  } catch (error) {
    console.error("Error reading database file:", error);
  }
  return {};
}

function writeDb(data) {
  try {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("Error writing to database file:", error);
  }
}

function saveToken(userId, token) {
  const db = readDb();
  db[userId] = { githubToken: token };
  writeDb(db);
}

function getToken(userId) {
  const db = readDb();
  return db[userId] ? db[userId].githubToken : null;
}

module.exports = { saveToken, getToken };
