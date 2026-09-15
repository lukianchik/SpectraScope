import { fetchJson } from './client';

interface WorkspaceRuntime {
        app_env: string;
        lab_mode: boolean;
        enable_real_scanners: boolean;
        local_real_scanners: boolean;
        enable_nmap: boolean;
        allow_benchmark_dns_proxy: boolean;
        scanner_timeout_seconds: number;
        scanner_max_results: number;
}

export interface WorkspaceSettings {
        allowed_target_domains: string[];
        allowed_lab_targets: string[];
        default_notification_channel: 'dashboard' | 'slack' | 'email';
        alert_threshold: 'info' | 'low' | 'medium' | 'high' | 'critical';
        updated_at: string | null;
        runtime: WorkspaceRuntime;
}

export type WorkspaceSettingsInput = Omit<WorkspaceSettings, 'updated_at' | 'runtime'>;

export interface Integration {
        id: string;
        name: string;
        kind: string;
        description: string;
        enabled: boolean;
        status: string;
        configured_fields: string[];
        updated_at: string;
}

interface MonitoringService {
        name: string;
        status: 'up' | 'warn' | 'down';
        detail: string;
}

export interface MonitoringSummary {
        scans_24h: number;
        findings_24h: number;
        failed_scans_24h: number;
        queued_scans: number;
        scan_history: number[];
        finding_history: number[];
        services: MonitoringService[];
}

export interface PathReview {
        step_id: string;
        reviewed: boolean;
        reviewed_by: string;
        updated_at: string;
}

export const getWorkspaceSettings = () =>
        fetchJson<WorkspaceSettings>('/api/workspace/settings');

export const updateWorkspaceSettings = (payload: WorkspaceSettingsInput) =>
        fetchJson<WorkspaceSettings>('/api/workspace/settings', {
                method: 'PUT',
                body: JSON.stringify(payload),
        });

export const listIntegrations = () => fetchJson<Integration[]>('/api/integrations');

export const updateIntegration = (id: string, enabled: boolean, config: Record<string, string> = {}) =>
        fetchJson<Integration>(`/api/integrations/${id}`, {
                method: 'PUT',
                body: JSON.stringify({ enabled, config }),
        });

export const getMonitoringSummary = () =>
        fetchJson<MonitoringSummary>('/api/monitoring/summary');

export const listPathReviews = (scanId: string) =>
        fetchJson<PathReview[]>(`/api/scans/${scanId}/path-reviews`);

export const updatePathReview = (scanId: string, stepId: string, reviewed: boolean) =>
        fetchJson<PathReview>(
                `/api/scans/${scanId}/path-reviews/${encodeURIComponent(stepId)}`,
                { method: 'PUT', body: JSON.stringify({ reviewed }) },
        );
