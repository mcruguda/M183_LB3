const express = require("express");
const http = require("http");
const { initializeAPI } = require("./api");
const rateLimit = require("express-rate-limit");

const limiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 50,
  message: "To many requests.",
});

// Create the express server
const app = express();
app.use(express.json());
app.use(limiter);
const server = http.createServer(app);

// deliver static files from the client folder like css, js, images
app.use(express.static("client"));
// route for the homepage
app.get("/", (req, res) => {
  res.removeHeader("X-Powered-By");
  res.sendFile(__dirname + "/client/index.html");
});

// Initialize the REST api
initializeAPI(app);

//start the web server
const serverPort = process.env.PORT || 3000;
server.listen(serverPort, () => {
  console.log(`Express Server started on port ${serverPort}`);
});
