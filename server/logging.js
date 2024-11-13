const fs = require("fs");

function log(prio, user, message) {
  const timestamp = new Date();
  fs.appendFile(
    "serverlogs.log",
    `[${prio}] ${timestamp} - ${user}: ${message} \n`,
    function (err) {
      if (err) throw err;
      console.log("Saved!");
    }
  );
}

module.exports = { log };
