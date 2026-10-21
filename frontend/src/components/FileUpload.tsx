import React, { useRef, useState } from "react";
import { useFileUpload } from "../hooks/useApi";
import { Button } from "./Button";

interface FileUploadProps {
  onUploadComplete: (files: string[]) => void;
  endpoint?: string;
  accept?: string;
  multiple?: boolean;
  maxSize?: number; // в байтах
  className?: string;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  onUploadComplete,
  endpoint = "/ajax/upload",
  accept = "image/*",
  multiple = false,
  maxSize = 10 * 1024 * 1024, // 10MB по умолчанию
  className = "",
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadFile, isLoading, error, progress } = useFileUpload();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter((file) => {
      if (file.size > maxSize) {
        alert(`Файл ${file.name} превышает максимальный размер`);
        return false;
      }
      return true;
    });

    setSelectedFiles(validFiles);
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;

    try {
      const allUploadedFiles: string[] = [];

      for (const file of selectedFiles) {
        const uploaded = await uploadFile(file, endpoint);
        allUploadedFiles.push(...uploaded);
      }

      setUploadedFiles([...uploadedFiles, ...allUploadedFiles]);
      onUploadComplete(allUploadedFiles);
      setSelectedFiles([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (err) {
      console.error("Upload error:", err);
    }
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRemoveUploaded = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* File Input */}
      <div className="flex items-center gap-4">
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleFileSelect}
          className="hidden"
        />
        <Button
          onClick={() => fileInputRef.current?.click()}
          variant="secondary"
        >
          Выбрать файлы
        </Button>
        {selectedFiles.length > 0 && (
          <span className="text-sm text-gray-600">
            Выбрано: {selectedFiles.length}
          </span>
        )}
      </div>

      {/* Selected Files */}
      {selectedFiles.length > 0 && (
        <div className="space-y-2">
          {selectedFiles.map((file, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-2 bg-gray-50 rounded"
            >
              <span className="text-sm truncate flex-1">{file.name}</span>
              <span className="text-xs text-gray-500 ml-2">
                {(file.size / 1024).toFixed(1)} KB
              </span>
              <button
                onClick={() => handleRemoveFile(index)}
                className="ml-2 text-red-500 hover:text-red-700"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          ))}
          <Button
            onClick={handleUpload}
            loading={isLoading}
            fullWidth
          >
            Загрузить файлы
          </Button>
        </div>
      )}

      {/* Progress Bar */}
      {isLoading && progress > 0 && (
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="text-sm text-red-500">{error}</div>
      )}

      {/* Uploaded Files */}
      {uploadedFiles.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Загруженные файлы:</h4>
          {uploadedFiles.map((file, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-2 bg-green-50 rounded"
            >
              <span className="text-sm truncate flex-1">{file}</span>
              <button
                onClick={() => handleRemoveUploaded(index)}
                className="ml-2 text-red-500 hover:text-red-700"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
