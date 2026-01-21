import axios from "axios";
import { AuthService } from "./AuthService";

const API_BASE_URL = "http://localhost:3000/api";

axios.interceptors.request.use((config) => {
  const token = AuthService.getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

axios.interceptors.response.use(
  (response) => response,
  (error) => {
    return Promise.reject(error);
  }
);

export interface FsNode {
  name: string;
  path: string;
  size: number;
  mimeType: string;
  createDate: string;
  updateDate: string;
  ownerId: string;
}

export class FileService {
  static async listDirectory(path: string = "/"): Promise<FsNode[]> {
    const response = await axios.get(`${API_BASE_URL}/fs/directory/list`, {
      params: { path },
    });
    return response.data.nodes;
  }

  static async createDirectory(path: string): Promise<void> {
    await axios.post(`${API_BASE_URL}/fs/directory`, { path });
  }

  static async deleteDirectory(path: string): Promise<void> {
    await axios.delete(`${API_BASE_URL}/fs/directory`, { data: { path } });
  }

  static async copyDirectory(path: string, newPath: string): Promise<void> {
    await axios.post(`${API_BASE_URL}/fs/directory/copy`, { path, newPath });
  }

  static async moveDirectory(path: string, newPath: string): Promise<void> {
    await axios.post(`${API_BASE_URL}/fs/directory/move`, { path, newPath });
  }

  static async uploadFile(path: string, file: File): Promise<void> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("path", path);
    await axios.post(`${API_BASE_URL}/fs/file`, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
  }

  static async downloadFile(path: string): Promise<Blob> {
    const response = await axios.get(`${API_BASE_URL}/fs/file`, {
      params: { path },
      responseType: "blob",
    });
    return response.data;
  }

  static async deleteFile(path: string): Promise<void> {
    await axios.delete(`${API_BASE_URL}/fs/file`, { data: { path } });
  }

  static async copyFile(path: string, newPath: string): Promise<void> {
    await axios.post(`${API_BASE_URL}/fs/file/copy`, { path, newPath });
  }

  static async moveFile(path: string, newPath: string): Promise<void> {
    await axios.post(`${API_BASE_URL}/fs/file/move`, { path, newPath });
  }

  static async getInfo(path: string): Promise<FsNode> {
    const response = await axios.get(`${API_BASE_URL}/fs/info`, {
      params: { path },
    });
    return response.data.info;
  }

  static async setWorkingDirectory(path: string): Promise<void> {
    await axios.post(`${API_BASE_URL}/fs/working-directory`, { path });
  }

  static async getWorkingDirectory(): Promise<string> {
    const response = await axios.get(`${API_BASE_URL}/fs/working-directory`);
    return response.data.workingDirectory;
  }

  static getFilePreviewUrl(path: string): string {
    return `${API_BASE_URL}/fs/file?path=${encodeURIComponent(path)}`;
  }
}
