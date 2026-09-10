import axios from "axios";

interface ValidationDetail {
  field: string;
  message: string;
}

export function formError(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as
      | { message?: string; details?: ValidationDetail[] }
      | undefined;
    if (data?.details?.length) {
      return data.details.map((d) => d.message).join(", ");
    }
    if (data?.message) return data.message;
  }
  return fallback;
}