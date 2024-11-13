const { initializeDatabase, queryDB, insertDB } = require("./database");
const bcrypt = require("bcrypt");
const { text } = require("express");
const z = require("zod");
const aesEncryption = require("aes-encryption");
const jwt = require("jsonwebtoken");
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
    username: z
      .string()
      .min(1, { message: "Username cannot be empty." })
      .email({ message: "Username needs to be a Email address." }),
  })
  .strip();

const tweetInputScheme = z
  .object({
    username: z
      .string()
      .min(1, { message: "Username cannot be empty." })
      .email({ message: "Username needs to be a Email address." }),
    timestamp: z.string().time(),
    text: z.string(),
  })
  .strip();

const getFeed = async (req, res) => {
  const query = "SELECT * FROM tweets ORDER BY id DESC";
  const authHeader = req.headers["authorization"];
  const token = authHeader.split(" ")[1];
  jwt.verify(token, secretKey, async (err) => {
    if (err) {
      req.log.error("Token invalid!");
      return res.sendStatus(403);
    }
    const tweets = await queryDB(db, query);
    for (let i = 0; i < tweets.length; i++) {
      tweets[i].username = aes.decrypt(tweets[i].username);
      tweets[i].timestamp = aes.decrypt(tweets[i].timestamp);
      tweets[i].text = aes.decrypt(tweets[i].text);
    }
    res.removeHeader("X-Powered-By");
    res.json(tweets);
  });
};

const postTweet = async (req, res) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader.split(" ")[1];
  const input = await tweetInputScheme.safeParse(req.body);
  if (input.success == false) {
    jwt.verify(token, secretKey, async (err) => {
      if (err) {
        req.log.error("Token invalid!");
        return res.sendStatus(403);
      }
    });
  }

  const encryptedUsername = aes.encrypt(username);
  const encryptedTimestamp = aes.encrypt(timestamp);
  const encryptedText = aes.encrypt(text);
  const query = `INSERT INTO tweets (username, timestamp, text) VALUES ('${encryptedUsername}', '${encryptedTimestamp}', '${encryptedText}')`;
  insertDB(db, query);
  res.removeHeader("X-Powered-By");
  res.json({ status: "ok" });
};

const login = async (req, res) => {
  const input = await inputScheme.safeParse(req.body);
  if (input.success == false) {
    return res.status(400).send(
      input.error.issues.map(({ message }) => {
        return { message };
      })
    );
  }

  const { username, password } = req.body;
  const query = `SELECT password FROM users WHERE username = '${username}'`;
  const userPassword = await queryDB(db, query);
  if (userPassword.length === 1) {
    const checkPassword = await bcrypt.compareSync(
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
      res.removeHeader("X-Powered-By");
      res.status(200).send({ user: username, token: jwtToken });
    } else {
      res.removeHeader("X-Powered-By");
      res.json("Your login is incorrect.");
    }
  } else {
    res.removeHeader("X-Powered-By");
    res.json("Your login is incorrect.");
  }
};

module.exports = { initializeAPI };
