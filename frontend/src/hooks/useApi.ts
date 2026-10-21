import { useState, useCallback } from "react";
import axios, { AxiosError } from "axios";

interface UseApiOptions {
  onSuccess?: (data: any) => void;
  onError?: (error: any) => void;
}

interface UseApiReturn {
  data: any;
  error: any;
  isLoading: boolean;
  execute: (config: any) => Promise<any>;
  reset: () => void;
}

// Создаем экземпляр axios с базовыми настройками
const api = axios.create({
  baseURL: "/ajax",
  headers: {
    "Content-Type": "application/json",
  },
});

// Интерцептор для обработки ответов
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response) {
      console.error("API Error:", error.response.data);
    } else if (error.request) {
      console.error("API Error: No response received");
    } else {
      console.error("API Error:", error.message);
    }
    return Promise.reject(error);
  }
);

export const useApi = ({ onSuccess, onError }: UseApiOptions = {}): UseApiReturn => {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const execute = useCallback(
    async (config: any) => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await api(config);
        setData(response.data);
        if (onSuccess) {
          onSuccess(response.data);
        }
      } catch (err) {
        setError(err);
        if (onError) {
          onError(err);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [onSuccess, onError]
  );

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setIsLoading(false);
  }, []);

  return {
    data,
    error,
    isLoading,
    execute,
    reset,
  };
};

// Хук для загрузки файлов (аналог fileupload из jQuery)
export const useFileUpload = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const uploadFile = useCallback(async (
    file: File,
    endpoint: string = "/upload"
  ): Promise<string[]> => {
    setIsLoading(true);
    setError(null);
    setProgress(0);

    const formData = new FormData();
    formData.append("files", file);

    try {
      const response = await axios.post(endpoint, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            setProgress(percentCompleted);
          }
        },
      });

      setProgress(100);
      return response.data.files || [];
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || "Ошибка загрузки файла";
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    uploadFile,
    isLoading,
    error,
    progress,
  };
};

// Хук для отправки формы (аналог $.ajax для форм)
export const useSubmitForm = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(async (
    endpoint: string,
    data: Record<string, any>,
    method: "POST" | "GET" = "POST"
  ): Promise<any> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await axios({
        method,
        url: endpoint,
        data,
        headers: {
          "Content-Type": "application/json",
        },
      });

      return response.data;
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || "Ошибка отправки формы";
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    submit,
    isLoading,
    error,
  };
};

export default api;
