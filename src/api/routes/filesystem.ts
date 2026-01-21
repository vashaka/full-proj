import { Router, Response } from "express";
import multer from "multer";
import { FsProvider } from "../../domain/interfaces/FsProvider";
import { AuthRequest, authenticateToken } from "../middleware/auth";
import { PathUtils } from "../../domain/utils/PathUtils";

const upload = multer({ storage: multer.memoryStorage() });

export function createFilesystemRouter(
  getFsProvider: (userId: string) => FsProvider
): Router {
  const router = Router();

  router.use(authenticateToken);
  router.post("/directory", async (req: AuthRequest, res: Response) => {
    try {
      const path = req.body.path;
      if (!path) {
        res.status(400).json({ error: "Path is required" });
        return;
      }

      const fsProvider = getFsProvider(req.userId!);
      await fsProvider.createDirectory(path);
      res.status(201).json({message: "created"});
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  router.delete("/directory", async (req: AuthRequest, res: Response) => {
    try {
      const path = req.body.path;
      if (!path) {
        res.status(400).json({ error: "Path is required" });
        return;
      }

      const fsProvider = getFsProvider(req.userId!);
      await fsProvider.deleteDirectory(path);
      res.json({});
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  router.post("/directory/copy", async (req: AuthRequest, res: Response) => {
    try {
      const path = req.body.path;
      const newPath = req.body.newPath;
      if (!path || !newPath) {
        res.status(400).json({ error: "Path and newPath are required" });
        return;
      }

      const fsProvider = getFsProvider(req.userId!);
      await fsProvider.copyDirectory(path, newPath);
      res.json({message: "copied"});
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  router.post("/directory/move", async (req: AuthRequest, res: Response) => {
    try {
      const path = req.body.path;
      const newPath = req.body.newPath;
      if (!path || !newPath) {
        res.status(400).json({ error: "Path and newPath are required" });
        return;
      }

      const fsProvider = getFsProvider(req.userId!);
      await fsProvider.moveDirectory(path, newPath);
      res.json({});
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  router.get("/directory/list", async (req: AuthRequest, res: Response) => {
    try {
      const path = (req.query.path as string) || "/";
      const fsProvider = getFsProvider(req.userId!);
      const nodes = await fsProvider.listDirectory(path);
      res.json({ nodes });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  router.post("/file", upload.single("file"), async (req: AuthRequest, res: Response) => {
      try {
        const path = req.body.path;
        if (!path) {
          res.status(400).json({ error: "Path is required" });
          return;
        }

        if (!req.file) {
          res.status(400).json({ error: "File is required" });
          return;
        }

        const fsProvider = getFsProvider(req.userId!);
        await fsProvider.writeFile(path, req.file.buffer);
        res.status(201).json({message: "uploaded"});
      } catch (error: any) {
        res.status(400).json({ error: error.message });
      }
    }
  );

  router.get("/file", async (req: AuthRequest, res: Response) => {
    try {
      const path = req.query.path as string;
      if (!path) {
        res.status(400).json({ error: "Path is required" });
        return;
      }

      const fsProvider = getFsProvider(req.userId!);
      const content = await fsProvider.readFile(path);
      const fileInfo = await fsProvider.getInfo(path);

      if (Buffer.isBuffer(content)) {
        res.setHeader("Content-Type", fileInfo.mimeType);
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${PathUtils.basename(path)}"`
        );
        res.send(content);
      } else {
        res.setHeader("Content-Type", fileInfo.mimeType);
        res.send(content);
      }
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  router.delete("/file", async (req: AuthRequest, res: Response) => {
    try {
      const { path } = req.body;
      if (!path) {
        res.status(400).json({ error: "Path is required" });
        return;
      }

      const fsProvider = getFsProvider(req.userId!);
      await fsProvider.deleteFile(path);
      res.json({message: "deleted"});
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  router.post("/file/copy", async (req: AuthRequest, res: Response) => {
    try {
      const path = req.body.path;
      const newPath = req.body.newPath;
      if (!path || !newPath) {
        res.status(400).json({ error: "Path and newPath are required" });
        return;
      }

      const fsProvider = getFsProvider(req.userId!);
      await fsProvider.copyFile(path, newPath);
      res.json({message: "copied"});
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  router.post("/file/move", async (req: AuthRequest, res: Response) => {
    try {
      const { path, newPath } = req.body;
      if (!path || !newPath) {
        return res.status(400).json({ error: "Path and newPath are required" });
      }

      const fsProvider = getFsProvider(req.userId!);
      await fsProvider.moveFile(path, newPath);
      res.json({message: "moved"});
    } catch (error: any) {
      return res.status(400).json({ error: error.message });
    }
  });

  router.get("/info", async (req: AuthRequest, res: Response) => {
    try {
      const path = (req.query.path as string) || "/";
      const fsProvider = getFsProvider(req.userId!);
      const info = await fsProvider.getInfo(path);
      res.json({ info });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  router.post("/working-directory", async (req: AuthRequest, res: Response) => {
    try {
      const { path } = req.body;
      if (!path) {
        res.status(400).json({ error: "Path is required" });
        return;
      }

      const fsProvider = getFsProvider(req.userId!);
      await fsProvider.setWorkingDirectory(path);
      res.json({message: "set"});
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  router.get("/working-directory", async (req: AuthRequest, res: Response) => {
    try {
      const fsProvider = getFsProvider(req.userId!);
      const workingDir = await fsProvider.getWorkingDirectory();
      res.json({ workingDirectory: workingDir });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  return router;
}
