type ApiError = {
  response?: {
    status?: number;
    data?: {
      detail?: unknown;
    };
  };
};

export function getAuthErrorMessage(error: unknown, action: "login" | "register"): string {
  const apiError = error as ApiError;
  const status = apiError?.response?.status;
  const detail = apiError?.response?.data?.detail;

  if (!apiError?.response) {
    return "Не удалось связаться с сервером. Проверьте интернет и попробуйте ещё раз.";
  }

  if (status === 401) {
    return "Неверный email или пароль. Проверьте данные и попробуйте ещё раз.";
  }

  if (status === 400) {
    if (detail === "User already exists") {
      return "Этот email или никнейм уже зарегистрирован. Попробуйте войти в аккаунт.";
    }
    if (detail === "User is inactive") {
      return "Аккаунт временно отключён. Обратитесь в поддержку.";
    }
    return "Не удалось выполнить запрос. Проверьте введённые данные.";
  }

  if (status === 422 && Array.isArray(detail)) {
    const fields = detail.map((entry: any) => entry?.loc?.at?.(-1));
    if (fields.includes("email")) return "Укажите корректный email.";
    if (fields.includes("username")) return "Никнейм должен содержать от 3 до 32 символов.";
    if (fields.includes("password")) return "Пароль должен содержать не менее 8 символов.";
    return "Проверьте правильность заполнения полей.";
  }

  if (status !== undefined && status >= 500) {
    return "Сервис временно недоступен. Попробуйте ещё раз чуть позже.";
  }

  return action === "login"
    ? "Не удалось войти. Проверьте данные и попробуйте ещё раз."
    : "Не удалось создать аккаунт. Проверьте введённые данные.";
}