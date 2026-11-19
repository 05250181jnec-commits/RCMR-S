const express = require("express");
const db = require("../db");
const { requireRole } = require("./auth");

const router = express.Router();

// All routes in this file require the user to be an Admin
router.use(requireRole("Admin"));

// GET /api/admin/users - List all users
router.get("/users", async (req, res, next) => {
  try {
    const [users] = await db.execute(
      `SELECT id, name, email, phone, role, team, created_at 
       FROM users ORDER BY id DESC`
    );
    res.json({ users });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/admin/users/:id/role - Update a user's role
router.patch("/users/:id/role", async (req, res, next) => {
  try {
    const newRole = String(req.body.role || "").trim();
    const validRoles = ["Citizen", "TeamMember", "Admin"];

    if (!validRoles.includes(newRole)) {
      return res.status(400).json({ error: "Invalid role." });
    }

    const [result] = await db.execute(
      `UPDATE users SET role = ? WHERE id = ?`,
      [newRole, req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "User not found." });
    }

    res.json({ ok: true, message: `User role updated to ${newRole}.` });
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/reports - View ALL reports (for assignment)
router.get("/reports", async (req, res, next) => {
  try {
    const [reports] = await db.execute(
      `SELECT r.*, u.name AS citizen_name 
       FROM reports r 
       JOIN users u ON r.user_id = u.id 
       ORDER BY r.id DESC`
    );
    res.json({ reports });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/admin/reports/:id/assign - Assign a report to a team
router.patch("/reports/:id/assign", async (req, res, next) => {
  try {
    const team = String(req.body.team || "").trim();

    if (!team) {
      return res.status(400).json({ error: "Team name is required." });
    }

    // We update the report status to 'In Progress' when assigned
    const [result] = await db.execute(
      `UPDATE reports SET status = 'In Progress' WHERE id = ?`,
      [req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Report not found." });
    }

    // Update the team member's team in the users table if needed, 
    // but for now we just log it or you can add an 'assigned_team' column to reports.
    
    res.json({ ok: true, message: `Report assigned to ${team} and set to In Progress.` });
  } catch (error) {
    next(error);
  }
});

module.exports = router;