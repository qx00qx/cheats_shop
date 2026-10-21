import React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  required?: boolean;
  fullWidth?: boolean;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  required = false,
  fullWidth = false,
  className = "",
  ...props
}) => {
  const baseStyles =
    "px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors";

  const errorStyles = error
    ? "border-red-500 focus:ring-red-500"
    : "border-gray-300 focus:border-blue-500";

  const widthStyle = fullWidth ? "w-full" : "";

  return (
    <div className={`flex flex-col gap-1 ${fullWidth ? "w-full" : ""}`}>
      {label && (
        <label className="text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <input
        className={`${baseStyles} ${errorStyles} ${widthStyle} ${className}`}
        {...props}
      />
      {error && <span className="text-sm text-red-500">{error}</span>}
    </div>
  );
};

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  required?: boolean;
  fullWidth?: boolean;
}

export const TextArea: React.FC<TextAreaProps> = ({
  label,
  error,
  required = false,
  fullWidth = false,
  className = "",
  ...props
}) => {
  const baseStyles =
    "px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors resize-none";

  const errorStyles = error
    ? "border-red-500 focus:ring-red-500"
    : "border-gray-300 focus:border-blue-500";

  const widthStyle = fullWidth ? "w-full" : "";

  return (
    <div className={`flex flex-col gap-1 ${fullWidth ? "w-full" : ""}`}>
      {label && (
        <label className="text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <textarea
        className={`${baseStyles} ${errorStyles} ${widthStyle} ${className}`}
        {...props}
      />
      {error && <span className="text-sm text-red-500">{error}</span>}
    </div>
  );
};

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  required?: boolean;
  fullWidth?: boolean;
  options: { value: string; label: string }[];
}

export const Select: React.FC<SelectProps> = ({
  label,
  error,
  required = false,
  fullWidth = false,
  options,
  className = "",
  ...props
}) => {
  const baseStyles =
    "px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors bg-white";

  const errorStyles = error
    ? "border-red-500 focus:ring-red-500"
    : "border-gray-300 focus:border-blue-500";

  const widthStyle = fullWidth ? "w-full" : "";

  return (
    <div className={`flex flex-col gap-1 ${fullWidth ? "w-full" : ""}`}>
      {label && (
        <label className="text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <select
        className={`${baseStyles} ${errorStyles} ${widthStyle} ${className}`}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && <span className="text-sm text-red-500">{error}</span>}
    </div>
  );
};

interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Checkbox: React.FC<CheckboxProps> = ({
  label,
  error,
  className = "",
  ...props
}) => {
  return (
    <div className="flex items-center gap-2">
      <input
        type="checkbox"
        className={`w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 ${className}`}
        {...props}
      />
      {label && (
        <label className="text-sm text-gray-700 cursor-pointer">{label}</label>
      )}
      {error && <span className="text-sm text-red-500">{error}</span>}
    </div>
  );
};
