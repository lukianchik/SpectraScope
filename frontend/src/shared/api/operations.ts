import { fetchJson } from './client';

type OperationStatus = 'ready' | 'running' | 'awaiting_approval' | 'completed' | 'aborted';
export type OperationAction = 'start' | 'map_surface' | 'correlate_exposure' | 'approve_path' | 'complete' | 'abort';

interface ScopeManifestResponse {
	allowed_targets: string[];
	source_scan_id: string;
	scan_profile: string;
	simulation_only: boolean;
	active_actions: boolean;
	expires_at: string;
}

export interface OperationEventResponse {
	id: string;
	sequence: number;
	event_type: 'system' | 'observed' | 'modeled' | 'human' | string;
	phase: string;
	decision: string | null;
	message: string;
	metadata_json: Record<string, unknown> | null;
	created_at: string;
}

export interface OperationResponse {
	id: string;
	scan_id: string | null;
	target: string;
	status: OperationStatus;
	current_phase: string;
	scope_manifest: ScopeManifestResponse;
	created_at: string;
	updated_at: string;
	completed_at: string | null;
	events: OperationEventResponse[];
}

export interface OperationListResponse {
	total: number;
	items: OperationResponse[];
}

export function createOperation(scanId: string) {
	return fetchJson<OperationResponse>('/api/operations', {
		method: 'POST',
		body: JSON.stringify({ scan_id: scanId, confirm_authorized: true }),
	});
}

export function listOperations(scanId: string) {
	return fetchJson<OperationListResponse>(`/api/operations?scan_id=${encodeURIComponent(scanId)}&limit=20`);
}

export function transitionOperation(operationId: string, action: OperationAction, confirmHuman = false) {
	return fetchJson<OperationResponse>(`/api/operations/${operationId}/transition`, {
		method: 'POST',
		body: JSON.stringify({ action, confirm_human: confirmHuman }),
	});
}
