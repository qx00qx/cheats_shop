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
};

export type EmailerCreate = {
  subject: string;
  from_email: string;
  to_email: string;
  cc_email: string | null;
  body: string;
};

export const EmailerAPI = {
  list: () => api.get<Emailer[]>("/emailer").then((r) => r.data),
  get: (id: number) => api.get<Emailer>(`/emailer/${id}`).then((r) => r.data),
  create: (data: EmailerCreate) => api.post<Emailer>("/emailer", data).then((r) => r.data),
  send: (id: number) => api.post<Emailer>(`/emailer/${id}/send`).then((r) => r.data),
  delete: (id: number) => api.delete(`/emailer/${id}`).then((r) => r.data),
};
