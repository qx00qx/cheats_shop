import React from "react";
import { useForm } from "../hooks/useForm";
import { useSubmitForm } from "../hooks/useApi";
import { useToast } from "../hooks/useToast";
import { Button } from "./Button";

interface FormProps {
  initialValues?: Record<string, any>;
  onSubmit?: (values: Record<string, any>) => void | Promise<void>;
  endpoint?: string;
  validateOnChange?: boolean;
  children: React.ReactNode;
  className?: string;
}

export const Form: React.FC<FormProps> = ({
  initialValues = {},
  onSubmit,
  endpoint,
  validateOnChange = false,
  children,
  className = "",
}) => {
  const { success, error } = useToast();
  const { submit, isLoading } = useSubmitForm();

  const handleSubmit = async (values: Record<string, any>) => {
    try {
      if (endpoint) {
        const response = await submit(endpoint, values);
        if (response.success) {
          success(response.msg || "Форма успешно отправлена");
          if (onSubmit) {
            await onSubmit(response);
          }
        } else {
          error(response.error || "Ошибка отправки формы");
        }
      } else if (onSubmit) {
        await onSubmit(values);
      }
    } catch (err) {
      error("Произошла ошибка при отправке формы");
    }
  };

  const {
    values,
    errors,
    touched,
    handleChange,
    handleBlur,
    handleSubmit: handleFormSubmit,
    resetForm,
  } = useForm({
    initialValues,
    onSubmit: handleSubmit,
    validateOnChange,
  });

  // Передаем контекст формы через children (если нужно использовать в будущем)
  const childrenWithProps = React.Children.map(children, (child) => {
    if (React.isValidElement(child)) {
      return React.cloneElement(child as any, {
        values,
        errors,
        touched,
        handleChange,
        handleBlur,
        resetForm,
        isLoading,
      });
    }
    return child;
  });

  return (
    <form onSubmit={handleFormSubmit} className={className}>
      {childrenWithProps}
    </form>
  );
};

// Компонент для быстрой формы (аналог form-ajax из jQuery)
interface QuickFormProps {
  endpoint: string;
  onSuccess?: (response: any) => void;
  children: React.ReactNode;
  className?: string;
}

export const QuickForm: React.FC<QuickFormProps> = ({
  endpoint,
  onSuccess,
  children,
  className = "",
}) => {
  const { success, error } = useToast();
  const { submit, isLoading } = useSubmitForm();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());

    try {
      const response = await submit(endpoint, data);
      if (response.success) {
        success(response.msg || "Успешно");
        if (onSuccess) {
          onSuccess(response);
        }
        // Очистка формы
        e.currentTarget.reset();
      } else {
        error(response.error || "Ошибка");
      }
    } catch (err) {
      error("Произошла ошибка");
    }
  };

  return (
    <form onSubmit={handleSubmit} className={className}>
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child) && child.type === Button) {
          return React.cloneElement(child as any, { loading: isLoading });
        }
        return child;
      })}
    </form>
  );
};
