import React, { useState, useEffect } from 'react';
import './FilePreview.css';
import { FileService, FsNode } from '../services/FileService';

interface FilePreviewProps {
  node: FsNode;
  onClose: () => void;
}

const FilePreview: React.FC<FilePreviewProps> = ({ node, onClose }) => {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    loadPreview();
    if (node.mimeType.startsWith('image/')) {
      setPreviewUrl(FileService.getFilePreviewUrl(node.path));
    } else {
      setPreviewUrl(null);
    }
  }, [node.path, node.mimeType]);

  const loadPreview = async () => {
    if (!isPreviewable(node.mimeType)) {
      return;
    }

    setLoading(true);
    setError('');
    try {
      const fileContent = await FileService.downloadFile(node.path);
      if (fileContent instanceof Blob) {
        const text = await fileContent.text();
        setContent(text);
      } else {
        setContent(String(fileContent));
      }
    } catch (err: any) {
      setError('Failed to load preview');
    } finally {
      setLoading(false);
    }
  };

  const isPreviewable = (mimeType: string): boolean => {
    return (
      mimeType.startsWith('text/') ||
      mimeType === 'application/json' ||
      mimeType === 'application/javascript' ||
      mimeType === 'application/xml' ||
      mimeType.startsWith('image/') ||
      mimeType === 'application/pdf'
    );
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString();
  };

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="file-preview">
      <div className="preview-header">
        <h3>{node.name}</h3>
        <button onClick={onClose} className="close-button">×</button>
      </div>

      <div className="preview-info">
        <div className="info-row">
          <span className="info-label">Path:</span>
          <span className="info-value">{node.path}</span>
        </div>
        <div className="info-row">
          <span className="info-label">Size:</span>
          <span className="info-value">{formatSize(node.size)}</span>
        </div>
        <div className="info-row">
          <span className="info-label">Type:</span>
          <span className="info-value">{node.mimeType}</span>
        </div>
        <div className="info-row">
          <span className="info-label">Created:</span>
          <span className="info-value">{formatDate(node.createDate)}</span>
        </div>
        <div className="info-row">
          <span className="info-label">Modified:</span>
          <span className="info-value">{formatDate(node.updateDate)}</span>
        </div>
      </div>

      <div className="preview-content">
        {loading ? (
          <div className="loading">Loading preview...</div>
        ) : error ? (
          <div className="error">{error}</div>
        ) : node.mimeType.startsWith('image/') && previewUrl ? (
          <img src={previewUrl} alt={node.name} className="preview-image" />
        ) : isPreviewable(node.mimeType) ? (
          <pre className="preview-text">{content}</pre>
        ) : (
          <div className="no-preview">
            Preview not available for this file type
          </div>
        )}
      </div>
    </div>
  );
};

export default FilePreview;

