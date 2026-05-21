const path = require("path");
const express = require("express");
const pinoHttp = require("pino-http");
const logger = require("./lib/logger");
const questionRouter = require("./routes/questions");
const authRouter  = require("./routes/auth");
const errorHandler = require("./middleware/errorHandler");

const app = express();
app.use(pinoHttp({logger, autoLogging:{ignore:(r)=>r.url.startsWith("/uploads")}}));
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));
app.use("/api/auth", authRouter);
app.use("/api/questions", questionRouter);
app.use((req, res) => res.status(404).json({ message: "Not found" }));
app.use(errorHandler);

module.exports = app;