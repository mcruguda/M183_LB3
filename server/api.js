const { initializeDatabase, queryDB, insertDB } = require("./database");
const bcrypt = require("bcrypt");
const { text } = require("express");
const z = require("zod");

let db;

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
  const tweets = await queryDB(db, query);
  res.removeHeader("X-Powered-By");
  res.json(tweets);
};

const postTweet = async (req, res) => {
  const input = await tweetInputScheme.safeParse(req.body);
  if (input.success == false) {
    return res.status(400).send(
      input.error.issues.map(({ message }) => {
        return { message };
      })
    );
  }

  const query = `INSERT INTO tweets (username, timestamp, text) VALUES ('${username}', '${timestamp}', '${text}')`;
  await fetch("/api/feed", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });
  insertDB(db, req.body.query);
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
  const hashedPassword = await bcrypt.hash(password, 10);
  const query = `SELECT password FROM users WHERE username = '${username}'`;
  const userPassword = await queryDB(db, query);
  if (userPassword.length === 1) {
    const checkPassword = await bcrypt.compareSync(
      password,
      userPassword[0].password
    );
    if (checkPassword === true) {
      const userQuery = `SELECT * FROM users WHERE username = '${username}'`;
      const user = await queryDB(db, userQuery);
      res.removeHeader("X-Powered-By");
      res.json(user[0]);
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
