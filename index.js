import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pool from "./db.js";
import bcrypt from "bcryptjs";
import nodemailer from "nodemailer";
import jwt from "jsonwebtoken";
import passport from "passport";
import session from "express-session";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

// ---------------- Passport & Session Setup ----------------
app.use(session({
  secret: process.env.SESSION_SECRET, // candycrush
  resave: false,
  saveUninitialized: true,
}));

app.use(passport.initialize());
app.use(passport.session());

// ----------------- Google OAuth -----------------
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL || "http://localhost:5000/auth/google/callback",
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails[0].value;
        const googleId = profile.id;

        // Check if user exists
        const userResult = await pool.query("SELECT * FROM users WHERE email=$1", [email]);
        let user;

        if (userResult.rowCount === 0) {
          // Create user if not exists, default role "user"
          const insertResult = await pool.query(
            "INSERT INTO users (email, google_id, role, created_at, streak, last_completed_date) VALUES ($1, $2, $3, NOW(), 0, NULL) RETURNING id, email, role",
            [email, googleId, "user"]
          );
          user = insertResult.rows[0];
        } else {
          user = userResult.rows[0];
        }

        done(null, user);
      } catch (err) {
        done(err, null);
      }
    }
  )
);

// Serialize/deserialize user
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

// Google auth routes
app.get("/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

app.get("/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "http://localhost:3000/"}),
  (req, res) => {
    // Redirect to frontend (homepage) with user info
    const user = req.user;
    res.redirect(`http://localhost:3000/?user=${encodeURIComponent(JSON.stringify(user))}`);
  }
);

// ---------------- CORS & JSON ----------------
app.use(cors());
app.use(express.json());

// ----------------- Nodemailer -----------------
const transporter = nodemailer.createTransport({
  service: "Gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

transporter.verify((error, success) => {
  if (error) console.error("Transporter error:", error);
  else console.log("Nodemailer ready to send emails");
});

// ----------------- Root -----------------
app.get("/", (req, res) => {
  res.send("To-Do List API is running!");
});

// ---------------- TODOS ----------------
app.get("/todos/:user_id", async (req, res) => {
  try {
    const { user_id } = req.params;
    const todos = await pool.query(
      "SELECT * FROM todos WHERE user_id=$1 ORDER BY id ASC",
      [user_id]
    );
    res.json(todos.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/todos", async (req, res) => {
  try {
    const { title, description, date, start_time, end_time, importance, user_id } = req.body;
    if (!user_id) return res.status(400).json({ error: "User ID is required" });

    const newTodo = await pool.query(
      `INSERT INTO todos (title, description, date, start_time, end_time, importance, user_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [title, description, date, start_time, end_time, importance, user_id]
    );

    res.json(newTodo.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Server error" });
  }
});

app.put("/todos/:id", async (req, res) => {
  const { id } = req.params;
  const { title, description, date, start_time, end_time, importance, completed, user_id } = req.body;

  try {
    const completed_at = completed ? new Date() : null;

    const result = await pool.query(
      `UPDATE todos SET
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        date = COALESCE($3, date),
        start_time = COALESCE($4, start_time),
        end_time = COALESCE($5, end_time),
        importance = COALESCE($6, importance),
        completed = COALESCE($7, completed),
        completed_at = COALESCE($8, completed_at)
       WHERE id = $9
       RETURNING *`,
      [title, description, date, start_time, end_time, importance, completed, completed_at, id]
    );

    const updatedTodo = result.rows[0];

    if (completed && user_id && date === new Date().toISOString().split("T")[0]) {
      const todayTasks = await pool.query(
        "SELECT COUNT(*) FROM todos WHERE user_id=$1 AND date=$2 AND completed=false",
        [user_id, date]
      );

      if (parseInt(todayTasks.rows[0].count) === 0) {
        await pool.query(
          "UPDATE users SET last_completed_date=$1 WHERE id=$2",
          [date, user_id]
        );
      }
    }

    res.json(updatedTodo);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.delete("/todos/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query("DELETE FROM todos WHERE id=$1", [id]);
    res.json({ message: "Todo deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ---------------- USERS ----------------
app.post("/register", async (req, res) => {
  try {
    const { email, password, role } = req.body; // role optional
    if (!email || !password)
      return res.status(400).json({ error: "Email and password are required" });

    const exists = await pool.query("SELECT * FROM users WHERE email=$1", [email]);
    if (exists.rows.length > 0)
      return res.status(400).json({ error: "Email already registered" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const userRole = role || "user"; // default role

    const result = await pool.query(
      "INSERT INTO users (email, password, role, created_at, streak, last_completed_date) VALUES ($1, $2, $3, NOW(), 0, NULL) RETURNING id, email, role",
      [email, hashedPassword, userRole]
    );

    res.status(201).json({ message: "User registered successfully", user: result.rows[0] });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) 
      return res.status(400).json({ error: "Email and password are required" });

    const userResult = await pool.query("SELECT * FROM users WHERE email=$1", [email]);
    if (userResult.rowCount === 0) 
      return res.status(401).json({ error: "Invalid email or password" });

    const user = userResult.rows[0];
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) 
      return res.status(401).json({ error: "Invalid email or password" });

    // Return role too
    res.json({ 
      message: "Login successful", 
      user: { id: user.id, email: user.email, role: user.role } 
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ---------------- NOTES ----------------
app.get("/notes/:user_id", async (req, res) => {
  try {
    const { user_id } = req.params;
    const notes = await pool.query(
      "SELECT * FROM notes WHERE user_id=$1 ORDER BY created_at DESC",
      [user_id]
    );
    res.json(notes.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/notes", async (req, res) => {
  try {
    const { title, content, user_id } = req.body;
    if (!user_id) return res.status(400).json({ error: "User ID is required" });

    const newNote = await pool.query(
      `INSERT INTO notes (title, content, user_id) VALUES ($1, $2, $3) RETURNING *`,
      [title, content, user_id]
    );
    res.json(newNote.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Server error" });
  }
});

app.put("/notes/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content } = req.body;

    const updated = await pool.query(
      `UPDATE notes SET title = COALESCE($1, title), content = COALESCE($2, content), updated_at = NOW() WHERE id=$3 RETURNING *`,
      [title, content, id]
    );
    res.json(updated.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Server error" });
  }
});

app.delete("/notes/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query("DELETE FROM notes WHERE id=$1", [id]);
    res.json({ message: "Note deleted" });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// ---------------- REWARDS / STREAK ----------------
app.post("/rewards/daily/:user_id", async (req, res) => {
  try {
    const { user_id } = req.params;
    const today = new Date().toISOString().split("T")[0];

    const userRes = await pool.query("SELECT streak, last_completed_date FROM users WHERE id=$1", [user_id]);
    if (userRes.rowCount === 0) return res.status(404).json({ error: "User not found" });

    let { streak, last_completed_date } = userRes.rows[0];

    if (last_completed_date) {
      const lastDate = new Date(last_completed_date);
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      if (lastDate.toISOString().split("T")[0] === yesterday.toISOString().split("T")[0]) streak += 1;
      else if (lastDate.toISOString().split("T")[0] === today) streak = streak;
      else streak = 1;
    } else streak = 1;

    await pool.query("UPDATE users SET streak=$1, last_completed_date=$2 WHERE id=$3", [streak, today, user_id]);
    res.json({ streak, message: "Daily reward updated!" });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// ---------------- FORGOT / RESET PASSWORD ----------------
app.post("/forgot-password", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email is required" });

  try {
    const userResult = await pool.query("SELECT * FROM users WHERE email=$1", [email]);
    if (userResult.rowCount === 0) return res.status(404).json({ error: "User not found" });

    const user = userResult.rows[0];
    const secret = process.env.JWT_SECRET + user.password;
    const token = jwt.sign({ id: user.id }, secret, { expiresIn: "15m" });

    const resetLink = `http://localhost:3000/reset-password/${user.id}/${token}`;

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Password Reset",
      html: `<p>Click <a href="${resetLink}">here</a> to reset your password. This link expires in 15 minutes.</p>`,
    });

    res.json({ message: "Password reset email sent" });
  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/reset-password/:id/:token", async (req, res) => {
  const { id, token } = req.params;
  const { password } = req.body;

  if (!password) return res.status(400).json({ error: "Password is required" });

  try {
    const userResult = await pool.query("SELECT * FROM users WHERE id=$1", [id]);
    if (userResult.rowCount === 0) return res.status(404).json({ error: "User not found" });

    const user = userResult.rows[0];
    const secret = process.env.JWT_SECRET + user.password;

    try {
      jwt.verify(token, secret);
    } catch {
      return res.status(400).json({ error: "Invalid or expired token" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query("UPDATE users SET password=$1 WHERE id=$2", [hashedPassword, id]);

    res.json({ message: "Password has been reset successfully" });
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({ error: "Server error" });
  }
});
// ---------------- ADMIN USERS ----------------
app.get("/admin/users", async (req, res) => {
  try {
    // Optionally, you can add authentication here to allow only admins
    const users = await pool.query(`
      SELECT u.id, u.email, u.role, u.created_at,
        COALESCE(t.tasks_count, 0) AS tasks_count,
        COALESCE(n.notes_count, 0) AS notes_count
      FROM users u
      LEFT JOIN (
        SELECT user_id, COUNT(*) AS tasks_count
        FROM todos
        GROUP BY user_id
      ) t ON t.user_id = u.id
      LEFT JOIN (
        SELECT user_id, COUNT(*) AS notes_count
        FROM notes
        GROUP BY user_id
      ) n ON n.user_id = u.id
      ORDER BY u.id ASC
    `);

    res.json(users.rows);
  } catch (err) {
    console.error("Admin users error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Add route to create a new admin
app.post("/admin/users", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password are required" });

    const exists = await pool.query("SELECT * FROM users WHERE email=$1", [email]);
    if (exists.rows.length > 0) return res.status(400).json({ error: "Email already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);

    const newAdmin = await pool.query(
      "INSERT INTO users (email, password, role, created_at, streak, last_completed_date) VALUES ($1, $2, $3, NOW(), 0, NULL) RETURNING id, email, role",
      [email, hashedPassword, "admin"]
    );

    res.status(201).json({ message: "Admin created successfully", user: newAdmin.rows[0] });
  } catch (err) {
    console.error("Create admin error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ---------------- ALL USERS ----------------
app.get("/users", async (req, res) => {
  try {
    const users = await pool.query(`
      SELECT u.id, u.email, u.role, u.created_at,
        COALESCE(t.tasks_count, 0) AS tasks_count,
        COALESCE(n.notes_count, 0) AS notes_count
      FROM users u
      LEFT JOIN (
        SELECT user_id, COUNT(*) AS tasks_count
        FROM todos
        GROUP BY user_id
      ) t ON t.user_id = u.id
      LEFT JOIN (
        SELECT user_id, COUNT(*) AS notes_count
        FROM notes
        GROUP BY user_id
      ) n ON n.user_id = u.id
      ORDER BY u.id ASC
    `);

    res.json(users.rows);
  } catch (err) {
    console.error("Get users error:", err);
    res.status(500).json({ error: "Server error" });
  }
});


// ---------------- START SERVER ----------------
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});