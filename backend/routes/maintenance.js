const express = require("express");
const db = require("../db");
const { requireRole } = require("./auth");
const multer = require("multer");
const path = require("path");

const router = express.Router();

// All routes here require a TeamMember or Admin
router.use(requireRole("TeamMember", "Admin"));

// Setup multer for completion proof uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/"); 
  },
  filename: function (req, file, cb) {
    cb(null, `completed-${Date.now()}${path.extname(file.originalname)}`);
  }
});
const upload = multer({ storage: storage });

// GET /api/maintenance/assigned - Get reports assigned to this team
router.get("/assigned", async (req, res, next) => {
  try {
    // In a real app, you would query reports where assigned_team = req.session.team
    // For now, we will just return all 'In Progress' reports to simulate the workflow
    const [reports] = await db.execute(
      `SELECT r.*, u.name AS citizen_name 
       FROM reports r 
       JOIN users u ON r.user_id = u.id 
       WHERE r.status = 'In Progress' 
       ORDER BY r.id DESC`
    );
    res.json({ reports });
  } catch (error) {
    next(error);
  }
});

// POST /api/maintenance/reports/:id/complete - Mark as complete & upload photo
router.post("/reports/:id/complete", upload.single("proof_image"), async (req, res, next) => {
  try {
    const imagePath = req.file ? `/uploads/${req.file.filename}` : null;
    
    // Update status to Completed
    const [result] = await db.execute(
      `UPDATE reports SET status = 'Completed' WHERE id = ?`,
      [req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Report not found." });
    }

    // NOTE: To save the proof image, you should add an `completion_image_path` column 
    // to your database. If you don't have it, this just updates the status.
    
    res.json({ ok: true, message: "Report marked as completed.", proof: imagePath });
  } catch (error) {
    next(error);
  }
});

module.exports = router;