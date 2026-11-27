const express = require("express");
const db = require("../db");
const { requireRole } = require("./auth");

const router = express.Router();

const ROAD_TYPES = ["Highway", "Village Road", "Urban Road"];
const ISSUE_TYPES = ["Potholes", "Cracks", "Road Block", "Drainage Blockage", "Landslide"];
const PRIORITIES = ["Low", "Medium", "High", "Critical"];
const STATUSES = ["Pending", "In Progress", "Completed"];

function requireLogin(req, res, next) {
  if (!req.session.userId) {
    // FOR DEMO: If not logged in, just pretend they are user 1
    req.session.userId = 1; 
  }
  next();
}

// GET /api/reports - Get reports (DEMO MODE)
router.get("/", async (req, res, next) => {
  try {
    const status = String(req.query.status || "").trim();

    let sql = `
      SELECT id, user_id, road_name, location, road_type, condition_type, priority,
             status, description, image_path,
             DATE_FORMAT(created_at, '%Y-%m-%d') AS date
      FROM reports
    `;
    let params = [];
    
    if (status && STATUSES.includes(status)) {
      sql += " WHERE status = ?";
      params.push(status);
    }
    
    sql += " ORDER BY id DESC";

    const [reports] = await db.execute(sql, params);
    res.json(reports); 
  } catch (error) {
    next(error);
  }
});

// POST /api/reports - Create a new report (NO FILE UPLOAD)
router.post("/", requireLogin, async (req, res, next) => {
  try {
    const roadName = String(req.body.road_name || "").trim();
    const location = String(req.body.location || "").trim();
    const roadType = String(req.body.road_type || "").trim();
    const conditionType = String(req.body.condition_type || "").trim();
    const priority = String(req.body.priority || "").trim();
    const description = String(req.body.description || "").trim();
    
    // We completely ignore the image and just save text
    const imagePath = null;

    if (roadName.length < 3) return res.status(400).json({ error: "Road name too short." });
    if (!ROAD_TYPES.includes(roadType)) return res.status(400).json({ error: "Invalid road type." });
    if (!PRIORITIES.includes(priority)) return res.status(400).json({ error: "Invalid priority." });

    const [result] = await db.execute(
      `INSERT INTO reports
         (user_id, road_name, location, road_type, condition_type, priority, description, image_path)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.session.userId, // This will be 1
        roadName,
        location,
        roadType,
        conditionType,
        priority,
        description,
        imagePath
      ]
    );

    res.status(201).json({
      report: {
        id: result.insertId,
        road_name: roadName,
        location,
        road_type: roadType,
        condition_type: conditionType,
        priority,
        status: "Pending",
        image_path: imagePath
      }
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/reports/:id/status - Update a report's status
router.patch("/:id/status", async (req, res, next) => {
  try {
    const newStatus = String(req.body.status || "").trim();
    if (!STATUSES.includes(newStatus)) {
      return res.status(400).json({ error: "Invalid status." });
    }

    const [result] = await db.execute(
      `UPDATE reports SET status = ? WHERE id = ?`,
      [newStatus, req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Report not found." });
    }

    res.json({ ok: true, message: `Status updated to ${newStatus}.` });
  } catch (error) {
    next(error);
  }
});

module.exports = router;