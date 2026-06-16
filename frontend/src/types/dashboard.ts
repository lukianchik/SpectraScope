import type {
	AssetResponse,
	FindingResponse,
	RiskReportResponse,
	ScanResponse,
	Severity,
} from '../shared/api/scans';

export type MetricTone = 'accent' | 'success' | 'warning' | 'critical' | 'neutral';
export type SeverityTone = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface Metric {
	label: string;
	value: string;
	delta: string;
	caption: string;
	tone: MetricTone;
	progress?: number;
}

export interface RiskBreakdownItem {
	label: string;
	value: number;
	percent: number;
	tone: SeverityTone;
}

export interface TrendPoint {
	label: string;
	value: number;
}

export interface RiskyAsset {
	name: string;
	ip: string;
	score: number;
	status: 'Monitored' | 'Critical' | 'Watchlist';
}

export interface ScanRecord {
	target: string;
	profile: string;
	status: 'Completed' | 'Running' | 'Failed';
	assets: number;
	findings: number;
	riskScore: number;
	finishedAt: string;
}

export interface FindingRecord {
	severity: SeverityTone;
	title: string;
	description: string;
	count: number;
}

export interface ScanStep {
	title: string;
	subtitle: string;
	completed: boolean;
	active?: boolean;
}

export interface ScanProgress {
	percent: number;
	label: string;
	detail: string;
	isActive: boolean;
}

export const LAB_TARGET_PRESETS = [
	'admin.lab.local:8088',
	'legacy.lab.local:8088',
	'files.lab.local:8088',
];

const SEVERITY_WEIGHTS: Record<Severity, number> = {
	critical: 5,
	high: 4,
	medium: 3,
	low: 2,
	info: 1,
};

export function buildMetrics(
	assets: AssetResponse[] = [],
	findings: FindingResponse[] = [],
	report: RiskReportResponse | null = null,
): Metric[] {
	const liveHosts = assets.filter((asset) => asset.is_alive).length;
	const criticalFindings = findings.filter((finding) => finding.severity === 'critical').length;
	const highRiskFindings = findings.filter((finding) =>
		['critical', 'high'].includes(finding.severity),
	).length;
	const technologies = new Set(
		assets.flatMap((asset) => asset.technologies ?? []).map((technology) => technology.toLowerCase()),
	).size;
	const riskScore = getRiskScore(findings);

	return [
		{
			label: 'Total Assets',
			value: String(assets.length),
			delta: `${technologies} techs`,
			caption: 'discovered for current scan',
			tone: 'accent',
		},
		{
			label: 'Live Hosts',
			value: String(liveHosts),
			delta: `${assets.length - liveHosts} offline`,
			caption: 'reachable right now',
			tone: 'success',
		},
		{
			label: 'Findings',
			value: String(findings.length),
			delta: `${highRiskFindings} high+`,
			caption: 'observations from scanner pipeline',
			tone: 'warning',
		},
		{
			label: 'Critical Findings',
			value: String(criticalFindings),
			delta: criticalFindings > 0 ? 'Needs triage' : 'Clear',
			caption: 'highest severity issues',
			tone: 'critical',
		},
		{
			label: 'Risk Score',
			value: `${riskScore} / 100`,
			delta: classifyRiskLabel(riskScore),
			caption: report ? 'summarized from current report' : 'derived from findings',
			tone: 'neutral',
			progress: riskScore,
		},
	];
}

export function buildScanSteps(
	scan: ScanResponse | null,
	assets: AssetResponse[] = [],
	findings: FindingResponse[] = [],
	report: RiskReportResponse | null = null,
	progressPercent = 0,
): ScanStep[] {
	const scanStarted = scan !== null;
	const scanFinished = scan?.status === 'completed' || scan?.status === 'failed';
	const hasAssets = assets.length > 0 || scanFinished;
	const hasFindings = findings.length > 0 || scanFinished;
	const activeStepIndex =
		scan?.status === 'created'
			? 0
			: scan?.status === 'running'
				? progressPercent < 45
					? 1
					: progressPercent < 88
						? 2
						: 3
				: -1;

	return [
		{
			title: 'Target',
			subtitle: scan?.target ?? 'Waiting for submission',
			completed: scanStarted,
			active: activeStepIndex === 0,
		},
		{
			title: 'Live Hosts',
			subtitle: scanStarted ? `${assets.length} discovered` : 'Pending',
			completed: hasAssets,
			active: activeStepIndex === 1,
		},
		{
			title: 'Findings',
			subtitle: scanStarted ? `${findings.length} flagged` : 'Pending',
			completed: hasFindings,
			active: activeStepIndex === 2,
		},
		{
			title: 'Report',
			subtitle: report ? 'Generated' : scan?.status === 'failed' ? 'Unavailable' : 'Pending',
			completed: report !== null,
			active: activeStepIndex === 3,
		},
	];
}

export function buildScanProgress(
	scan: ScanResponse | null,
	assets: AssetResponse[] = [],
	findings: FindingResponse[] = [],
	report: RiskReportResponse | null = null,
	now = Date.now(),
): ScanProgress {
	if (!scan) {
		return {
			percent: 0,
			label: 'Idle',
			detail: 'Waiting for a target',
			isActive: false,
		};
	}

	if (scan.status === 'completed') {
		return {
			percent: 100,
			label: 'Completed',
			detail: report ? 'Report generated' : 'Scan finished',
			isActive: false,
		};
	}

	if (scan.status === 'failed') {
		return {
			percent: 100,
			label: 'Failed',
			detail: 'Review the error message',
			isActive: false,
		};
	}

	if (scan.status === 'created') {
		return {
			percent: 8,
			label: 'Queued',
			detail: 'Waiting for worker',
			isActive: true,
		};
	}

	const startedAt = parseBackendTimestamp(scan.started_at ?? scan.created_at).getTime();
	const elapsedSeconds = Math.max(0, Math.floor((now - startedAt) / 1000));
	const timedProgress = Math.min(88, 12 + Math.floor((elapsedSeconds / 45) * 76));
	const dataProgress = Math.max(assets.length > 0 ? 52 : 0, findings.length > 0 ? 72 : 0);
	const percent = Math.max(timedProgress, dataProgress);

	if (percent < 35) {
		return {
			percent,
			label: 'Discovery',
			detail: `Enumerating target surface (${elapsedSeconds}s)`,
			isActive: true,
		};
	}

	if (percent < 62) {
		return {
			percent,
			label: 'HTTP probing',
			detail: `${assets.length} live host${assets.length === 1 ? '' : 's'} found`,
			isActive: true,
		};
	}

	if (percent < 88) {
		return {
			percent,
			label: 'Scanner checks',
			detail: `Running safe nuclei checks (${elapsedSeconds}s)`,
			isActive: true,
		};
	}

	return {
		percent,
		label: 'Report',
		detail: 'Compiling results',
		isActive: true,
	};
}

export function getRiskScore(findings: FindingResponse[] = []) {
	const score = findings.reduce((total, finding) => total + SEVERITY_WEIGHTS[finding.severity], 0);
	return Math.min(score, 100);
}

export function formatScanStatus(status: ScanResponse['status'] | null) {
	switch (status) {
		case 'created':
			return 'Created';
		case 'running':
			return 'Running';
		case 'completed':
			return 'Completed';
		case 'failed':
			return 'Failed';
		default:
			return 'Idle';
	}
}

export function formatStatusHeadline(scan: ScanResponse | null) {
	switch (scan?.status) {
		case 'created':
			return 'Scan queued for execution';
		case 'running':
			return 'Scan is currently running';
		case 'completed':
			return 'Scan completed successfully';
		case 'failed':
			return 'Scan failed';
		default:
			return 'Start a scan to populate the dashboard';
	}
}

export function formatStatusMeta(
	scan: ScanResponse | null,
	assetsCount: number,
	findingsCount: number,
	report: RiskReportResponse | null = null,
) {
	if (!scan) {
		return 'Pick a lab preset or enter a target, then confirm authorization to begin.';
	}

	if (scan.status === 'failed') {
		return scan.error_message ?? `Scan for ${scan.target} failed before the report stage.`;
	}

	const summaryParts = [`Target ${scan.target}`, `${assetsCount} assets`, `${findingsCount} findings`];

	if (report) {
		summaryParts.push(`${report.recommendations.length} recommendations`);
	}

	if (scan.finished_at) {
		summaryParts.push(`Finished ${formatUtcTimestamp(scan.finished_at)}`);
	} else if (scan.started_at) {
		summaryParts.push(`Started ${formatUtcTimestamp(scan.started_at)}`);
	} else {
		summaryParts.push(`Queued ${formatUtcTimestamp(scan.created_at)}`);
	}

	return summaryParts.join(' • ');
}

export function formatUtcTimestamp(value: string) {
	return new Intl.DateTimeFormat(undefined, {
		dateStyle: 'medium',
		timeStyle: 'short',
	}).format(parseBackendTimestamp(value));
}

function classifyRiskLabel(score: number) {
	if (score >= 75) {
		return 'High';
	}

	if (score >= 35) {
		return 'Medium';
	}

	if (score > 0) {
		return 'Low';
	}

	return 'Minimal';
}

function parseBackendTimestamp(value: string) {
	const hasTimezone = /(?:z|[+-]\d{2}:\d{2})$/i.test(value);
	return new Date(hasTimezone ? value : `${value}Z`);
}
