import { fetchJson } from './client';

type ScanStatus = 'created' | 'running' | 'completed' | 'failed' | 'cancelled';
export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type ScanProfile = 'discovery' | 'safe' | 'lab' | 'local-real';

export interface ScanStartInput {
	target: string;
	scan_profile: ScanProfile;
	confirm_authorized: boolean;
}

export interface ScanResponse {
	id: string;
	target: string;
	status: ScanStatus;
	scan_profile: ScanProfile;
	created_at: string;
	started_at: string | null;
	finished_at: string | null;
	error_message: string | null;
	current_stage?: string;
	progress_percent?: number;
	cancellation_requested?: boolean;
	stage_diagnostics?: StageDiagnostic[];
}

export interface StageDiagnostic {
	stage: string;
	tool: string;
	status: 'running' | 'completed' | 'failed';
	started_at: string;
	finished_at: string | null;
	duration_ms: number | null;
	target_count: number | null;
	result_count: number | null;
	exit_code: number | null;
	error: string | null;
}

export interface ScanListResponse {
	total: number;
	limit: number;
	offset: number;
	items: ScanResponse[];
}

export interface AssetResponse {
	id: string;
	scan_id: string;
	hostname: string;
	ip: string | null;
	is_alive: boolean;
	http_status: number | null;
	title: string | null;
	technologies: string[] | null;
	created_at: string;
}

export interface AssetListResponse {
	total: number;
	limit: number;
	offset: number;
	items: AssetResponse[];
}

export interface FindingResponse {
	id: string;
	scan_id: string;
	asset_id: string | null;
	source_tool: string;
	template_id: string | null;
	name: string;
	severity: Severity;
	description: string | null;
	matched_at: string | null;
	cve: string | null;
	cvss: number | null;
	raw_json: Record<string, unknown> | null;
	triage_status?: 'open' | 'in_progress' | 'resolved' | 'accepted_risk' | 'false_positive';
	assigned_to?: string | null;
	triage_note?: string | null;
	updated_at?: string;
	created_at: string;
}

export interface FindingListResponse {
	total: number;
	limit: number;
	offset: number;
	items: FindingResponse[];
}

export interface RiskReportResponse {
	id: string;
	scan_id: string;
	summary: string;
	top_risks: RiskItemResponse[];
	recommendations: string[];
	created_at: string;
}

interface ListScansOptions {
	limit?: number;
	offset?: number;
	status?: ScanStatus;
}

interface ListAssetsOptions {
	limit?: number;
	offset?: number;
}

interface ListFindingsOptions {
	limit?: number;
	offset?: number;
}

export function startScan(payload: ScanStartInput) {
	return fetchJson<ScanResponse>('/api/scans/start', {
		method: 'POST',
		body: JSON.stringify(payload),
	});
}

export function listScans(options: ListScansOptions = {}) {
	return fetchJson<ScanListResponse>(
		`/api/scans${withQuery({
			limit: options.limit,
			offset: options.offset,
			status: options.status,
		})}`,
	);
}

export function getScan(scanId: string) {
	return fetchJson<ScanResponse>(`/api/scans/${scanId}`);
}

interface RiskItemResponse {
	name?: string | null;
	risk?: string | null;
	severity: Severity;
	score?: number | null;
	affected_assets?: number | null;
	assets?: number | null;
	source_tool?: string | null;
	template_id?: string | null;
	cve?: string | null;
	finding_ids?: string[];
	asset_ids?: string[];
	matched_at?: string | null;
	reason?: string | null;
	recommended_action?: string | null;
}

export function cancelScan(scanId: string) {
	return fetchJson<ScanResponse>(`/api/scans/${scanId}/cancel`, { method: 'POST' });
}

export function deleteScan(scanId: string) {
	return fetchJson<void>(`/api/scans/${scanId}`, { method: 'DELETE' });
}

export function getScanAssets(scanId: string, options: ListAssetsOptions = {}) {
	return fetchJson<AssetListResponse>(
		`/api/scans/${scanId}/assets${withQuery({
			limit: options.limit,
			offset: options.offset,
		})}`,
	);
}

export function getScanFindings(scanId: string, options: ListFindingsOptions = {}) {
	return fetchJson<FindingListResponse>(
		`/api/scans/${scanId}/findings${withQuery({
			limit: options.limit,
			offset: options.offset,
		})}`,
	);
}

export function triageFinding(
	scanId: string,
	findingId: string,
	payload: { status: NonNullable<FindingResponse['triage_status']>; assigned_to?: string | null; note?: string | null },
) {
	return fetchJson<FindingResponse>(`/api/scans/${scanId}/findings/${findingId}`, {
		method: 'PATCH',
		body: JSON.stringify(payload),
	});
}

export function getScanReport(scanId: string) {
	return fetchJson<RiskReportResponse>(`/api/scans/${scanId}/report`);
}

function withQuery(params: Record<string, string | number | undefined> | undefined) {
	const searchParams = new URLSearchParams();

	for (const [key, value] of Object.entries(params ?? {})) {
		if (value !== undefined) {
			searchParams.set(key, String(value));
		}
	}

	const query = searchParams.toString();
	return query ? `?${query}` : '';
}
