const { initializeDatabase, queryDB, insertDB } = require("./database");
const bcrypt = require("bcrypt");
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

const getFeed = async (req, res) => {
  const query = req.query.q;
  const tweets = await queryDB(db, query);
  res.json(tweets);
};

const postTweet = (req, res) => {
  insertDB(db, req.body.query);
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
      res.json(user[0]);
    } else {
      res.json("Your login is incorrect.");
    }
  } else {
    res.json("Your login is incorrect.");
  }
};

module.exports = { initializeAPI };
