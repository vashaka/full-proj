import { Router, Request, Response } from "express";
import * as bcrypt from "bcryptjs";
import { UserRepository } from "../../infrastructure/repositories/UserRepository";
import { generateToken } from "../middleware/auth";

export function createAuthRouter(userRepository: UserRepository): Router {
  const router = Router();

  router.post("/register", async (req: Request, res: Response) => {
    try {
      const { username, email, password } = req.body;

      if (!username || !email || !password) {
        return res
          .status(400)
          .json({ error: "username, email, and password required" });
      }

      const existingUser = await userRepository.findByUsername(username);
      if (existingUser) {
        return res.status(409).json({ error: "username exists" });
      }

      const existingEmail = await userRepository.findByEmail(email);
      if (existingEmail) {
        return res.status(409).json({ error: "email exists" });
      }

      const passwordHash = await bcrypt.hash(password, 10);

      const user = await userRepository.createUser({
        username,
        email,
        passwordHash,
      });

      const token = generateToken(user.id);
      res.status(201).json({ token, user });
    } catch (error: any) {
      res.status(500).json({ error: "server error" });
    }
  });

  router.post("/login", async (req: Request, res: Response) => {
    try {
      const username = req.body.username;
      const password = req.body.password;

      if (!username || !password) {
        return res
          .status(400)
          .json({ error: "Username and password required" });
      }

      const user = await userRepository.findByUsername(username);
      if (!user) {
        return res.status(401).json({ error: "Invalid" });
      }

      const isValidPassword = await bcrypt.compare(password, user.passwordHash);
      if (!isValidPassword) {
        return res.status(401).json({ error: "Invalid" });
      }

      const token = generateToken(user.id);
      res.json({ token, user });
    } catch (error: any) {
      res.status(500).json({ error: "server error" });
    }
  });

  return router;
}
