import React, { useState, useEffect } from "react";
import "./FileManager.css";
import { FileService, FsNode } from "../services/FileService";
import { AuthService } from "../services/AuthService";
import FilePreview from "./FilePreview";

interface FileManagerProps {
  onLogout: () => void;
}

const FileManager: React.FC<FileManagerProps> = ({ onLogout }) => {
  const [currentPath, setCurrentPath] = useState("/");
  const [nodes, setNodes] = useState<FsNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedNode, setSelectedNode] = useState<FsNode | null>(null);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [moveCopyNode, setMoveCopyNode] = useState<FsNode | null>(null);
  const [moveCopyType, setMoveCopyType] = useState<"move" | "copy" | null>(
    null
  );
  const [moveCopyPath, setMoveCopyPath] = useState("");

  useEffect(() => {
    const loadInitialDirectory = async () => {
      try {
        await loadDirectory(currentPath);
      } catch (err: any) {
        if (currentPath === "/" && err.response?.status === 400) {
          try {
            await FileService.createDirectory("/");
            await loadDirectory(currentPath);
          } catch (createErr: any) {
            console.error("Error creating root directory:", createErr);
          }
        }
      }
    };
    loadInitialDirectory();
  }, [currentPath]);

  const loadDirectory = async (path: string) => {
    setLoading(true);
    setError("");
    try {
      const directoryNodes = await FileService.listDirectory(path);
      setNodes(directoryNodes);
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.error || err.message || "Failed to load directory";
      setError(errorMessage);
      if (err.response?.status === 401 || err.response?.status === 403) {
        setError("Authentication failed. Please log in again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleNodeClick = async (node: FsNode) => {
    if (node.mimeType === "inode/directory") {
      setCurrentPath(node.path);
      setSelectedNode(null);
    } else {
      setSelectedNode(node);
    }
  };

  const handleBack = () => {
    if (currentPath !== "/") {
      const parentPath = currentPath.split("/").slice(0, -1).join("/") || "/";
      setCurrentPath(parentPath);
      setSelectedNode(null);
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      setError("Folder name cannot be empty");
      return;
    }

    try {
      setError("");
      const newPath =
        currentPath === "/"
          ? `/${newFolderName}`
          : `${currentPath}/${newFolderName}`;
      await FileService.createDirectory(newPath);
      setShowCreateFolder(false);
      setNewFolderName("");
      await loadDirectory(currentPath);
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.error || err.message || "Failed to create folder";
      setError(errorMessage);
    }
  };

  const handleDelete = async (node: FsNode) => {
    if (!window.confirm(`Are you sure you want to delete ${node.name}?`)) {
      return;
    }

    try {
      if (node.mimeType === "inode/directory") {
        await FileService.deleteDirectory(node.path);
      } else {
        await FileService.deleteFile(node.path);
      }
      loadDirectory(currentPath);
      if (selectedNode?.path === node.path) {
        setSelectedNode(null);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to delete");
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError("");
    try {
      const filePath =
        currentPath === "/" ? `/${file.name}` : `${currentPath}/${file.name}`;
      await FileService.uploadFile(filePath, file);
      await loadDirectory(currentPath);
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.error || err.message || "Failed to upload file";
      setError(errorMessage);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleDownload = async (node: FsNode) => {
    try {
      const blob = await FileService.downloadFile(node.path);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = node.name;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to download file");
    }
  };

  const handleMove = (node: FsNode) => {
    setMoveCopyNode(node);
    setMoveCopyType("move");
    setMoveCopyPath("");
  };

  const handleCopy = (node: FsNode) => {
    setMoveCopyNode(node);
    setMoveCopyType("copy");
    setMoveCopyPath("");
  };

  const handleMoveCopy = async () => {
    if (!moveCopyNode || !moveCopyType || !moveCopyPath.trim()) {
      setError("Please enter a destination path");
      return;
    }

    try {
      setError("");
      const destinationPath = moveCopyPath.startsWith("/")
        ? moveCopyPath
        : `${currentPath === "/" ? "" : currentPath}/${moveCopyPath}`;

      if (moveCopyNode.mimeType === "inode/directory") {
        if (moveCopyType === "move") {
          await FileService.moveDirectory(moveCopyNode.path, destinationPath);
        } else {
          await FileService.copyDirectory(moveCopyNode.path, destinationPath);
        }
      } else {
        if (moveCopyType === "move") {
          await FileService.moveFile(moveCopyNode.path, destinationPath);
        } else {
          await FileService.copyFile(moveCopyNode.path, destinationPath);
        }
      }

      setMoveCopyNode(null);
      setMoveCopyType(null);
      setMoveCopyPath("");
      await loadDirectory(currentPath);
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.error ||
        err.message ||
        `Failed to ${moveCopyType} ${
          moveCopyNode.mimeType === "inode/directory" ? "directory" : "file"
        }`;
      setError(errorMessage);
    }
  };

  const user = AuthService.getUser();
  const directories = nodes.filter((n) => n.mimeType === "inode/directory");
  const files = nodes.filter((n) => n.mimeType !== "inode/directory");

  return (
    <div className="file-manager">
      <header className="file-manager-header">
        <div className="header-left">
          <h1>File Manager</h1>
          <span className="user-info">Welcome, {user?.username}</span>
        </div>
        <button onClick={onLogout} className="logout-button">
          Logout
        </button>
      </header>

      <div className="file-manager-content">
        <div className="file-browser">
          <div className="toolbar">
            <button onClick={handleBack} disabled={currentPath === "/"}>
              ← Back
            </button>
            <button onClick={() => setShowCreateFolder(true)}>
              + New Folder
            </button>
            <label className="upload-button">
              {uploading ? "Uploading..." : "+ Upload File"}
              <input
                type="file"
                onChange={handleUpload}
                disabled={uploading}
                style={{ display: "none" }}
              />
            </label>
            <div className="path-display">{currentPath}</div>
          </div>

          {error && <div className="error-message">{error}</div>}

          {showCreateFolder && (
            <div className="create-folder-dialog">
              <input
                type="text"
                placeholder="Folder name"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === "Enter") handleCreateFolder();
                  if (e.key === "Escape") {
                    setShowCreateFolder(false);
                    setNewFolderName("");
                  }
                }}
                autoFocus
              />
              <div>
                <button onClick={handleCreateFolder}>Create</button>
                <button
                  onClick={() => {
                    setShowCreateFolder(false);
                    setNewFolderName("");
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {moveCopyNode && moveCopyType && (
            <div className="create-folder-dialog">
              <h4>
                {moveCopyType === "move" ? "Move" : "Copy"}{" "}
                {moveCopyNode.mimeType === "inode/directory"
                  ? "Directory"
                  : "File"}
              </h4>
              <p>From: {moveCopyNode.path}</p>
              <input
                type="text"
                placeholder="Destination path"
                value={moveCopyPath}
                onChange={(e) => setMoveCopyPath(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === "Enter") handleMoveCopy();
                  if (e.key === "Escape") {
                    setMoveCopyNode(null);
                    setMoveCopyType(null);
                    setMoveCopyPath("");
                  }
                }}
                autoFocus
              />
              <div>
                <button onClick={handleMoveCopy}>
                  {moveCopyType === "move" ? "Move" : "Copy"}
                </button>
                <button
                  onClick={() => {
                    setMoveCopyNode(null);
                    setMoveCopyType(null);
                    setMoveCopyPath("");
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="loading">Loading...</div>
          ) : (
            <div className="file-list">
              {directories.map((node) => (
                <div
                  key={node.path}
                  className="file-item directory"
                  onClick={() => handleNodeClick(node)}
                >
                  <span className="file-icon">📁</span>
                  <span className="file-name">{node.name}</span>
                  <div className="file-actions">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMove(node);
                      }}
                    >
                      Move
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopy(node);
                      }}
                    >
                      Copy
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(node);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}

              {files.map((node) => (
                <div
                  key={node.path}
                  className={`file-item file ${
                    selectedNode?.path === node.path ? "selected" : ""
                  }`}
                  onClick={() => handleNodeClick(node)}
                >
                  <span className="file-icon">📄</span>
                  <span className="file-name">{node.name}</span>
                  <span className="file-size">
                    {(node.size / 1024).toFixed(2)} KB
                  </span>
                  <div className="file-actions">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownload(node);
                      }}
                    >
                      Download
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMove(node);
                      }}
                    >
                      Move
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopy(node);
                      }}
                    >
                      Copy
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(node);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}

              {nodes.length === 0 && (
                <div className="empty-directory">Directory is empty</div>
              )}
            </div>
          )}
        </div>

        {selectedNode && (
          <div className="file-preview-panel">
            <FilePreview
              node={selectedNode}
              onClose={() => setSelectedNode(null)}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default FileManager;
