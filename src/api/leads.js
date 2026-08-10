import { apiRequest } from "./client";

export async function submitProjectRequest(payload) {
  return apiRequest("/api/project-requests/", { method: "POST", body: payload });
}

export async function submitContactMessage(payload) {
  return apiRequest("/api/contact-messages/", { method: "POST", body: payload });
}

export async function submitTransportWaitlist(payload) {
  return apiRequest("/api/transport-waitlist/", { method: "POST", body: payload });
}
