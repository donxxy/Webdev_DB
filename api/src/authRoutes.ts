import { Request, Response, Router } from "express";
import { validateResource } from "./validate";
import { authRequestSchema } from "./schemas";
import { pool } from "./db";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "Fallback_secret";

router.post(
  "/register",
  validateResource(authRequestSchema),
  async (req: Request, res: Response) => {
    const { username, password } = req.body;

    try {
      const userCheck = await pool.query(
        `SELECT username FROM users WHERE username = $1`,
        [username],
      );
      if (userCheck.rows.length > 0) {
        return res.status(409).json({ error: "Username already exist." });
      }

      const saltsRounds = 10;
      const passwordHash = await bcrypt.hash(password, saltsRounds);

      const result = await pool.query(
        `
            INSERT INTO users (username, password_hash)
            VALUES ($1, $2)
            RETURNING id, username, created_at`,
        [username, passwordHash],
      );
      res.status(201).json({
        message: "User registered successfully!",
        user: result.rows[0],
      });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  },
);
router.post(
  "/login",
  validateResource(authRequestSchema),
  async (req: Request, res: Response) => {
    const { username, password } = req.body;
    try {
      const result = await pool.query(
        `
            SELECT * FROM users WHERE username = $1`,
        [username],
      );

      const user = result.rows[0];
      if (!user) {
        return res.status(401).json({ error: "Invalid username or password." });
      }

      const isValidPassword = await bcrypt.compare(
        password,
        user.password_hash,
      );
      if (isValidPassword) {
        const token = jwt.sign(
          { userId: user.id, username: user.username },
          JWT_SECRET,
          { expiresIn: "1h" },
        );
        return res.json({ message: "Login successful", token });
      }

      res.status(401).json({ error: "Invalid username or password." });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  },
);

router.delete("/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `DELETE FROM users
      WHERE id = $1
      RETURNING *`,
      [id],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
