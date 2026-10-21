export const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

export const isStrongPassword = (v: string) => v.length >= 8;

// Проверка обязательных полей (аналог validateForm из app.js)
export const validateField = (
  value: string,
  type: string,
  checked?: boolean
): { valid: boolean; error?: string } => {
  if (type === "checkbox" || type === "radio") {
    if (!checked) {
      return { valid: false, error: "Это поле обязательно" };
    }
  } else {
    if (!value || value.trim() === "") {
      return { valid: false, error: "Это поле обязательно" };
    }
    if (type === "email" && !isValidEmail(value)) {
      return { valid: false, error: "Некорректный email" };
    }
    if (type === "tel" && !/^\+?[\d\s\-\(\)]+$/.test(value)) {
      return { valid: false, error: "Некорректный телефон" };
    }
  }
  return { valid: true };
};

// Валидация всей формы
export const validateForm = (
  formData: Record<string, any>,
  requiredFields: string[]
): { valid: boolean; errors: Record<string, string> } => {
  const errors: Record<string, string> = {};
  let valid = true;

  requiredFields.forEach((field) => {
    const value = formData[field];
    if (!value || (typeof value === "string" && value.trim() === "")) {
      errors[field] = "Это поле обязательно";
      valid = false;
    }
  });

  return { valid, errors };
};