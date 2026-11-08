import { api } from "./client";

export type Emailer = {
  id: number;
  created_at: string;
  last_send: string | null;
  subject: string;
  from_email: string;
  to_email: string;
  cc_email: string | null;
  body: string;
  is_sent: boolean;
  send_status: "draft" | "sending" | "sent" | "partial" | "failed";
  recipient_count: number;
  sent_count: number;
  failed_count: number;
  last_error: string | null;
};

export type EmailerCreate = {
  subject: string;
  from_email: string;
  to_email: string | null;
  cc_email: string | null;
  body: string;
};

export type EmailerServiceStatus = {
  configured: boolean;
  provider: string;
  api_url: string;
  recipient_count: number;
};

export const EmailerAPI = {
  list: () => api.get<Emailer[]>("/emailer").then((r) => r.data),
  status: () => api.get<EmailerServiceStatus>("/emailer/status").then((r) => r.data),
  get: (id: number) => api.get<Emailer>(`/emailer/${id}`).then((r) => r.data),
  create: (data: EmailerCreate) => api.post<Emailer>("/emailer", data).then((r) => r.data),
  send: (id: number) => api.post<Emailer>(`/emailer/${id}/send`).then((r) => r.data),
  delete: (id: number) => api.delete(`/emailer/${id}`).then((r) => r.data),
};
