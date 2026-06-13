const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000').replace(
	/\/$/,
	'',
);

interface BackendErrorPayload {
	error?: {
		code?: string;
		message?: string;
		details?: unknown;
	};
	detail?: string | { message?: string; code?: string; details?: unknown; scan_id?: string };
	message?: string;
}

export class ApiError extends Error {
	code?: string;
	details?: unknown;
	status: number;

	constructor(message: string, status: number, code?: string, details?: unknown) {
		super(message);
		this.name = 'ApiError';
		this.status = status;
		this.code = code;
		this.details = details;
	}
}

export async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
	const response = await fetch(`${API_BASE_URL}${path}`, {
		...init,
		headers: {
			'Content-Type': 'application/json',
			...(init?.headers ?? {}),
		},
	});

	if (!response.ok) {
		throw await buildApiError(response);
	}

	if (response.status === 204) {
		return undefined as T;
	}

	return (await response.json()) as T;
}

export function getApiErrorMessage(error: unknown): string {
	if (error instanceof ApiError) {
		return error.message;
	}

	if (error instanceof Error) {
		return error.message;
	}

	return 'Unexpected API error';
}

async function buildApiError(response: Response): Promise<ApiError> {
	let payload: BackendErrorPayload | null = null;

	try {
		payload = (await response.json()) as BackendErrorPayload;
	} catch {
		payload = null;
	}

	if (payload?.error?.message) {
		return new ApiError(
			payload.error.message,
			response.status,
			payload.error.code,
			payload.error.details,
		);
	}

	if (typeof payload?.detail === 'string') {
		return new ApiError(payload.detail, response.status);
	}

	if (payload?.detail && typeof payload.detail === 'object') {
		return new ApiError(
			payload.detail.message ?? response.statusText,
			response.status,
			payload.detail.code,
			payload.detail.details ?? payload.detail,
		);
	}

	if (payload?.message) {
		return new ApiError(payload.message, response.status);
	}

	return new ApiError(response.statusText || 'Request failed', response.status);
}
