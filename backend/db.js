const mysql = require("mysql2");

const pool = mysql.createPool({
    host: "localhost",
    user: "root",
    password: "",          // Leave empty for XAMPP default
    database: "rcmrs_dev", // Make sure this matches your phpMyAdmin database!
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Test the connection on startup
pool.query("SELECT 1", (err, results) => {
    if (err) {
        console.error("❌ Database connection failed:", err.message);
    } else {
        console.log("✅ Connected to MySQL Database successfully!");
    }
});

// Export the promise-based pool so `await db.query()` works in your routes
module.exports = pool.promise();