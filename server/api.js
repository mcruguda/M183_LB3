const { initializeDatabase, queryDB, insertDB } = require("./database");
const bcrypt = require("bcrypt");
const { text } = require("express");
const z = require("zod");
const aesEncryption = require("aes-encryption");
const jwt = require("jsonwebtoken");
const { log } = require("./logging");
require("dotenv").config();

let db;
const secretKey = process.env.SECRETKEY;
const cryptoKey = process.env.CRYPTOKEY;
const aes = new aesEncryption();
aes.setSecretKey(cryptoKey);

const initializeAPI = async (app) => {
  db = await initializeDatabase();
  app.get("/api/feed", getFeed);
  app.post("/api/feed", postTweet);
  app.post("/api/login", login);
};

const inputScheme = z
  .object({
    username: z.string().min(1, { message: "Username cannot be empty." }),
  })
  .strict();

const tweetInputScheme = z
  .object({
    username: z.string().min(1, { message: "Username cannot be empty." }),
    text: z.string(),
  })
  .strict();

const getFeed = async (req, res) => {
  const query = "SELECT username, timestamp, text FROM tweets ORDER BY id DESC";
  //ToDo: Midlewares
  const authHeader = req.headers["authorization"];
  const user = req.headers["username"];
  const token = authHeader.split(" ")[1];
  try {
    jwt.verify(token, secretKey, async (err) => {
      if (err) {
        log("Warning", `${user}`, `Could not verify Token!`);
        return res.sendStatus(403);
      }
      try {
        const tweets = await queryDB(db, query);
        if (tweets.length >= 1) {
          for (let i = 0; i < tweets.length; i++) {
            tweets[i].username = aes.decrypt(tweets[i].username);
            tweets[i].timestamp = aes.decrypt(tweets[i].timestamp);
            tweets[i].text = aes.decrypt(tweets[i].text);
          }
        }
        log("Info", `${user}`, `Successfully loaded feed!`);
        res.json(tweets);
      } catch (err) {
        log(
          "Error",
          "Database",
          `There was an Error when trying to get tweets from the database: ${err}`
        );
      }
    });
  } catch (err) {
    log("Error", "Server", `Error trying to verify a token: ${err}`);
  }
};

const postTweet = async (req, res) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader.split(" ")[1];
  const { reqUsername, timestamp, text } = req.body;

  const input = await tweetInputScheme.safeParse(req.body);
  if (input.success === true) {
    jwt.verify(token, secretKey, async (err, decoded) => {
      if (err) {
        log("Warning", `${reqUsername}`, `Error verifying Token!`);
        return res.sendStatus(403);
      }

      const { username } = decoded.data;

      if (reqUsername !== username) {
        log(
          "Warning",
          `${reqUsername}`,
          `Token does not match the signed in user!`
        );
        return res.sendStatus(403);
      }
    });
  }

  const encryptedUsername = aes.encrypt(reqUsername);
  const encryptedTimestamp = aes.encrypt(timestamp);
  const encryptedText = aes.encrypt(text);
  const query = `INSERT INTO tweets (username, timestamp, text) VALUES ('${encryptedUsername}', '${encryptedTimestamp}', '${encryptedText}')`;
  try {
    insertDB(db, query);
  } catch (err) {
    log(
      "Error",
      "Database",
      `There was an Error when trying to insert int o the database: ${err}`
    );
  }
  log("Info", `${reqUsername}`, `Successfully created a post!`);
  res.json({ status: "ok" });
};

const login = async (req, res) => {
  const input = await inputScheme.safeParse(req.body);
  if (input.success == false) {
    return res.status(400).send(
      input.error.issues.map(({ message }) => {
        log("Warning", "unknown", "Input is invalid!");
        return "Invalid login!";
      })
    );
  }

  const { username, password } = req.body;
  const query = `SELECT password FROM users WHERE username = '${username}'`;
  try {
    const userPassword = await queryDB(db, query);
    if (userPassword.length === 1) {
      const checkPassword = bcrypt.compareSync(
        password,
        userPassword[0].password
      );
      if (checkPassword === true) {
        const jwtToken = jwt.sign(
          {
            exp: Math.floor(Date.now() / 1000) + 60 * 60,
            data: { username },
          },
          secretKey
        );
        const userQuery = `SELECT * FROM users WHERE username = '${username}'`;
        const user = await queryDB(db, userQuery);
        log("Info", `${username}`, `Successful login!`);
        res.status(200).send({ user: username, token: jwtToken });
      } else {
        log("Warning", "unknown", `Incorrect login for ${username}!`);
        res.json("Your login is incorrect.");
      }
    } else {
      log("Warning", "unknown", `Login on non existent username: ${username}`);
      res.json("Your login is incorrect.");
    }
  } catch (err) {
    log(
      "Error",
      "Database",
      `There was an Error when trying to get the User: ${err}`
    );
  }
};

module.exports = { initializeAPI };
