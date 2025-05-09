// index.js
const express = require("express");
const app = express();
const PORT = process.env.PORT || 5000;

app.get("/", (req, res) => {
  res.json({
    message: "Welcome to the Product Locator API!",
    version: "v1",
    author: "Mohd Shehzad",
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
