export class PathUtils {
  static normalize(path: string): string {
    if (!path) return "/";
    let normalized = path.replace(/\/+$/, "") || "/";
    normalized = normalized.replace(/\/+/g, "/");
    if (!normalized.startsWith("/")) {
      normalized = "/" + normalized;
    }
    return normalized;
  }

  static join(...parts: string[]): string {
    return this.normalize(parts.filter((p) => p).join("/"));
  }

  static dirname(path: string): string {
    const normalized = this.normalize(path);
    if (normalized === "/") return "/";
    const parts = normalized.split("/").filter((p) => p);
    if (parts.length <= 1) return "/";
    return "/" + parts.slice(0, -1).join("/");
  }

  static basename(path: string): string {
    const normalized = this.normalize(path);
    if (normalized === "/") return "/";
    const parts = normalized.split("/").filter((p) => p);
    return parts[parts.length - 1] || "/";
  }

  static isAncestor(ancestor: string, descendant: string): boolean {
    const ancestorNormalized = this.normalize(ancestor);
    const descendantNormalized = this.normalize(descendant);
    if (ancestorNormalized === "/") {
      return descendantNormalized !== "/";
    }
    return descendantNormalized.startsWith(ancestorNormalized + "/");
  }

  static resolve(workingDir: string, path: string): string {
    if (path.startsWith("/")) {
      return this.normalize(path);
    }
    return this.normalize(this.join(workingDir, path));
  }
}
