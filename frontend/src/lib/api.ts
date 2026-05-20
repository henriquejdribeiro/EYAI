import type { HealthStatus, ProjectPlan, TeamMember } from "../types";

const BASE = "/api";

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText} — ${detail}`);
  }
  return res.json() as Promise<T>;
}

export function getHealth(): Promise<HealthStatus> {
  return jsonFetch<HealthStatus>(`${BASE}/health`);
}

export function getTeam(): Promise<TeamMember[]> {
  return jsonFetch<TeamMember[]>(`${BASE}/team`);
}

export async function extractPdf(file: File): Promise<{ text: string; filename: string; chars: number }> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE}/projects/extract`, { method: "POST", body: form });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function parseTeamUpload(file: File): Promise<TeamMember[]> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE}/team/parse`, { method: "POST", body: form });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export function generatePlan(payload: {
  project_text: string;
  project_name?: string;
  sprint_count: number;
  sprint_length_days: number;
  team: TeamMember[];
}): Promise<ProjectPlan> {
  return jsonFetch<ProjectPlan>(`${BASE}/plan`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export interface SampleProject {
  key: string;
  filename: string;
  size_bytes: number;
  pdf_url: string;
  text_url: string;
}

export function listSamples(): Promise<SampleProject[]> {
  return jsonFetch<SampleProject[]>(`${BASE}/samples`);
}

export function fetchSampleText(key: string): Promise<{ key: string; filename: string; text: string; chars: number }> {
  return jsonFetch(`${BASE}/samples/${key}/text`);
}

export function fetchTeamRaw(): Promise<{ text: string; exists: boolean; filename: string }> {
  return jsonFetch(`${BASE}/team/raw`);
}
