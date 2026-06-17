/**
 * aiService.ts
 * Calls the local Flask ML API for wait-time predictions and branch recommendations.
 * API runs on http://localhost:5000 (or set AI_API_URL env variable for production).
 */

const AI_API_URL = 'http://10.0.2.2:5000'; // Android emulator → host localhost

// ─── Types ────────────────────────────────────────────────────────────────────

export type PredictParams = {
  queue_length: number;
  avg_service_time: number;
  hour_of_day: number;
  day_of_week: number;
  staff_count: number;
  branch_id: string;
};

export type PredictResult = {
  estimated_wait_minutes: number;
  wait_range: string;
  is_peak_hour: boolean;
};

export type BranchInput = {
  id: string;
  name: string;
  queue_length: number;
  avg_service_time: number;
  staff_count: number;
  lat: number;
  lng: number;
};

export type RecommendResult = {
  branches: {
    branch_id: string;
    branch_name: string;
    queue_length: number;
    estimated_wait: number;
    distance_km: number;
    score: number;
    recommended: boolean;
    wait_range: string;
  }[];
  best: {
    branch_id: string;
    branch_name: string;
    estimated_wait: number;
    wait_range: string;
    recommended: true;
  } | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nowParts() {
  const now = new Date();
  return { hour: now.getHours(), day: now.getDay() };
}

async function apiFetch<T>(path: string, body: object): Promise<T> {
  const res = await fetch(`${AI_API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`AI API error ${res.status}`);
  return res.json() as Promise<T>;
}

// ─── Wait time prediction ──────────────────────────────────────────────────────

export async function predictWaitTime(params: PredictParams): Promise<PredictResult> {
  const { hour, day } = nowParts();
  return apiFetch<PredictResult>('/predict', {
    queue_length:     params.queue_length,
    avg_service_time: params.avg_service_time,
    hour_of_day:      params.hour_of_day ?? hour,
    day_of_week:      params.day_of_week ?? day,
    staff_count:      params.staff_count,
    branch_id:        params.branch_id,
  });
}

/** Convenience wrapper — passes current time automatically. */
export async function getWaitTime(
  branchId: string,
  queueLength: number,
  avgServiceTime: number,
  staffCount: number,
): Promise<PredictResult> {
  const { hour, day } = nowParts();
  return predictWaitTime({
    queue_length:     queueLength,
    avg_service_time: avgServiceTime,
    hour_of_day:      hour,
    day_of_week:      day,
    staff_count:      staffCount,
    branch_id:        branchId,
  });
}

// ─── Branch recommendation ────────────────────────────────────────────────────

export async function recommendBranch(
  branches: BranchInput[],
  userLat = 31.5204,
  userLng = 74.3587,
): Promise<RecommendResult> {
  const { hour, day } = nowParts();
  return apiFetch<RecommendResult>('/recommend', {
    user_lat:    userLat,
    user_lng:    userLng,
    hour_of_day: hour,
    day_of_week: day,
    branches,
  });
}

// ─── Feedback loop: log served token to improve model ─────────────────────────

export async function logServedToken(params: {
  queue_length: number;
  avg_service_time: number;
  hour_of_day: number;
  day_of_week: number;
  staff_count: number;
  branch_id: string;
  actual_wait_minutes: number;
}) {
  try {
    await fetch(`${AI_API_URL}/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
  } catch {
    // Non-critical: model logging should not break the app
  }
}

// ─── Fallback (when API is unreachable) ───────────────────────────────────────

export function estimateWaitFallback(queueLength: number, avgServiceTime: number): PredictResult {
  const est = Math.max(2, Math.round((queueLength * avgServiceTime) / 3));
  return {
    estimated_wait_minutes: est,
    wait_range:             `${Math.max(1, est - 3)}–${est + 3} min`,
    is_peak_hour:           false,
  };
}