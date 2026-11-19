require("dotenv").config();

const express = require("express");
const cors = require("cors");
const session = require("express-session");
const MySQLStore = require("express-mysql-session")(session);
const db = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;

const sessionStore = new MySQLStore(
  {
    createDatabaseTable: false,
    schema: {
      tableName: "sessions",
      columnNames: {
        session_id: "session_id",
        expires: "expires",
        data: "data"
      }
    }
  },
  db
);

// Allow the frontend running through VS Code Live Server to use session cookies.
app.use(cors({
  origin: "http://127.0.0.1:5500",
  credentials: true
}));

app.use(express.json());

app.use(session({
  name: "rcmrs.sid",
  secret: process.env.SESSION_SECRET,
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    maxAge: 8 * 60 * 60 * 1000
  }
}));

// --- ROUTES ---
app.use("/api/auth", require("./routes/auth"));
app.use("/api/reports", require("./routes/reports"));
app.use("/api/admin", require("./routes/admin"));
app.use("/api/maintenance", require("./routes/maintenance"));

app.get("/api/health", async (req, res) => {
  try {
    await db.query("SELECT 1");
    res.json({ status: "ok", database: "connected" });
  } catch (error) {
    console.error("Database health check failed:", error.message);
    res.status(503).json({ status: "error", database: "disconnected" });
  }
});

// --- ERROR HANDLERS ---

// 1. Catch-all for routes that don't exist (404)
app.use((req, res) => {
  res.status(404).json({ error: "Route not found." });
});

// 2. Global error handler for unhandled errors (500)
app.use((error, req, res, next) => {
  console.error("Request failed:", error.message);
  res.status(500).json({ error: "Internal server error." });
});

// --- START SERVER ---
async function startServer() {
  try {
    await sessionStore.onReady();
    app.listen(PORT, () => {
      console.log(`RCMRS API running at http://127.0.0.1:${PORT}`);
    });
  } catch (error) {
    console.error("Session store failed to start:", error.message);
    process.exit(1);
  }
}

startServer();