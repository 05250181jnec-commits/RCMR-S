const express = require("express");
const db = require("../db");
const multer = require("multer");
const path = require("path");
const { requireRole } = require("./auth");

const router = express.Router();

const ROAD_TYPES = ["Highway", "Village Road", "Urban Road"];
const ISSUE_TYPES = ["Potholes", "Cracks", "Road Block", "Drainage Blockage", "Landslide"];
const PRIORITIES = ["Low", "Medium", "High", "Critical"];
const STATUSES = ["Pending", "In Progress", "Completed"];

function requireLogin(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Please log in first." });
  }
  next();
}

// --- FILE UPLOAD CONFIGURATION ---
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/"); // Make sure you create an "uploads" folder in your backend directory!
  },
  filename: function (req, file, cb) {
    // Give the file a unique name: timestamp + original extension
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Limit file size to 5MB
  fileFilter: function (req, file, cb) {
    // Only allow images
    const fileTypes = /jpeg|jpg|png/;
    const extname = fileTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = fileTypes.test(file.mimetype);
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error("Only images (jpeg, jpg, png) are allowed."));
  }
});

// GET /api/reports - Get reports
router.get("/", requireLogin, async (req, res, next) => {
  try {
    const status = String(req.query.status || "").trim();

    if (status && !STATUSES.includes(status)) {
      return res.status(400).json({ error: "Invalid report status." });
    }

    const isStaff = req.session.role === "Admin" || req.session.role === "TeamMember";
    
    let sql = `
      SELECT id, user_id, road_name, location, road_type, condition_type, priority,
             status, description, image_path,
             DATE_FORMAT(created_at, '%Y-%m-%d') AS date
      FROM reports
    `;
    let params = [];
    let conditions = [];

    if (!isStaff) {
      conditions.push("user_id = ?");
      params.push(req.session.userId);
    }

    if (status) {
      conditions.push("status = ?");
      params.push(status);
    }

    if (conditions.length > 0) {
      sql += " WHERE " + conditions.join(" AND ");
    }
    
    sql += " ORDER BY id DESC";

    const [reports] = await db.execute(sql, params);
    res.json(reports); 
  } catch (error) {
    next(error);
  }
});

// GET /api/reports/:id - Get a single report
router.get("/:id", requireLogin, async (req, res, next) => {
  try {
    const [rows] = await db.execute(
      `SELECT id, user_id, road_name, location, road_type, condition_type, priority,
              status, description, image_path, created_at
       FROM reports WHERE id = ?`,
      [req.params.id]
    );

    if (!rows[0]) {
      return res.status(404).json({ error: "Report not found." });
    }

    const isStaff = req.session.role === "Admin" || req.session.role === "TeamMember";
    if (!isStaff && rows[0].user_id !== req.session.userId) {
      return res.status(403).json({ error: "You do not have permission to view this report." });
    }

    res.json({ report: rows[0] });
  } catch (error) {
    next(error);
  }
});

// POST /api/reports - Create a new report (NOW WITH FILE UPLOAD)
// Notice we added upload.single("image") here!
router.post("/", requireLogin, upload.single("image"), async (req, res, next) => {
  try {
    const roadName = String(req.body.road_name || "").trim();
    const location = String(req.body.location || "").trim();
    const roadType = String(req.body.road_type || "").trim();
    const conditionType = String(req.body.condition_type || "").trim();
    const priority = String(req.body.priority || "").trim();
    const description = String(req.body.description || "").trim();
    
    // If a file was uploaded, req.file exists. Otherwise, it's null.
    const imagePath = req.file ? `/uploads/${req.file.filename}` : null;

    if (roadName.length < 3 || roadName.length > 100) {
      return res.status(400).json({ error: "Road name must be 3 to 100 characters." });
    }
    if (location.length < 3 || location.length > 150) {
      return res.status(400).json({ error: "Location must be 3 to 150 characters." });
    }
    if (!ROAD_TYPES.includes(roadType)) {
      return res.status(400).json({ error: "Invalid road type." });
    }
    if (!ISSUE_TYPES.includes(conditionType)) {
      return res.status(400).json({ error: "Invalid issue type." });
    }
    if (!PRIORITIES.includes(priority)) {
      return res.status(400).json({ error: "Invalid priority." });
    }
    if (description.length < 10 || description.length > 1000) {
      return res.status(400).json({ error: "Description must be 10 to 1000 characters." });
    }

    const [result] = await db.execute(
      `INSERT INTO reports
         (user_id, road_name, location, road_type, condition_type, priority, description, image_path)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.session.userId,
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
router.patch("/:id/status", requireRole("Admin", "TeamMember"), async (req, res, next) => {
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

// DELETE /api/reports/:id - Delete a report
router.delete("/:id", requireRole("Admin"), async (req, res, next) => {
  try {
    const [result] = await db.execute(
      `DELETE FROM reports WHERE id = ?`,
      [req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Report not found." });
    }

    res.json({ ok: true, message: "Report deleted." });
  } catch (error) {
    next(error);
  }
});

module.exports = router;