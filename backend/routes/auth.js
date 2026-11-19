const express = require("express");
const bcrypt = require("bcryptjs");
const db = require("../db");

const router = express.Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function requireLogin(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: "Please log in first." });
  }

  next();
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: "Please log in first." });
    }

    if (!allowedRoles.includes(req.session.role)) {
      return res.status(403).json({ error: "You do not have permission." });
    }

    next();
  };
}

// Public registration always creates a Citizen account.
router.post("/register", async (req, res, next) => {
  try {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const phone = String(req.body.phone || "").trim();
    const password = String(req.body.password || "");

    if (name.length < 3 || name.length > 60) {
      return res.status(400).json({
        error: "Name must be 3 to 60 characters."
      });
    }

    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({
        error: "Enter a valid email address."
      });
    }

    if (phone.length < 5 || phone.length > 20) {
      return res.status(400).json({
        error: "Enter a valid phone number."
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        error: "Password must be at least 8 characters."
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const [result] = await db.execute(
      `INSERT INTO users (name, email, phone, password_hash, role)
       VALUES (?, ?, ?, ?, 'Citizen')`,
      [name, email, phone, passwordHash]
    );

    res.status(201).json({
      ok: true,
      userId: result.insertId
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        error: "Email already registered."
      });
    }

    next(error);
  }
});

// Local demo only: resets the one test account configured in the backend .env.
router.post("/forgot-password", async (req, res, next) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const demoEmail = String(process.env.DEMO_RESET_EMAIL || "")
      .trim()
      .toLowerCase();
    const temporaryPassword = String(process.env.DEMO_RESET_PASSWORD || "");

    if (process.env.NODE_ENV !== "development") {
      return res.status(404).json({
        error: "Reset route is unavailable."
      });
    }

    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({
        error: "Enter a valid email address."
      });
    }

    if (
      !demoEmail ||
      !temporaryPassword ||
      temporaryPassword.length < 12 ||
      email !== demoEmail
    ) {
      return res.json({
        ok: true,
        message: "If this is the configured demo account, its reset is available."
      });
    }

    const passwordHash = await bcrypt.hash(temporaryPassword, 12);

    const [result] = await db.execute(
      "UPDATE users SET password_hash = ? WHERE email = ?",
      [passwordHash, email]
    );

    if (result.affectedRows === 0) {
      return res.json({
        ok: true,
        message: "If this is the configured demo account, its reset is available."
      });
    }

    res.json({
      ok: true,
      message:
        "Demo password reset. Use the temporary password configured in the backend .env file."
    });
  } catch (error) {
    next(error);
  }
});

// Login accepts any role already assigned to the account in MySQL.
router.post("/login", async (req, res, next) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    const [rows] = await db.execute(
      `SELECT id, name, email, password_hash, role, team
       FROM users
       WHERE email = ?`,
      [email]
    );

    const user = rows[0];

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({
        error: "Invalid email or password."
      });
    }

    req.session.regenerate((sessionError) => {
      if (sessionError) return next(sessionError);

      req.session.userId = user.id;
      req.session.role = user.role;

      req.session.save((saveError) => {
        if (saveError) return next(saveError);

        res.json({
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            team: user.team || null
          }
        });
      });
    });
  } catch (error) {
    next(error);
  }
});

// Return the account attached to this server-side session.
router.get("/me", requireLogin, async (req, res, next) => {
  try {
    const [rows] = await db.execute(
      `SELECT id, name, email, phone, role, team
       FROM users
       WHERE id = ?`,
      [req.session.userId]
    );

    if (!rows[0]) {
      return res.status(401).json({
        error: "Account not found."
      });
    }

    res.json({ user: rows[0] });
  } catch (error) {
    next(error);
  }
});

// End the session and clear its browser cookie.
router.post("/logout", requireLogin, (req, res, next) => {
  req.session.destroy((error) => {
    if (error) return next(error);

    res.clearCookie("rcmrs.sid", {
      path: "/",
      httpOnly: true,
      sameSite: "lax"
    });

    res.json({ ok: true });
  });
});

module.exports = router;
module.exports.requireLogin = requireLogin;
module.exports.requireRole = requireRole;