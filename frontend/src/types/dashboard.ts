import type {
	AssetResponse,
	FindingResponse,
	RiskReportResponse,
	ScanResponse,
	Severity,
} from '../shared/api/scans';

type MetricTone = 'accent' | 'success' | 'warning' | 'critical' | 'neutral';

export interface Metric {
	label: string;
	value: string;
	delta: string;
	caption: string;
	tone: MetricTone;
	progress?: number;
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
	{ target: 'perimeter.lab.local:8088', profile: 'local-real' as const, label: 'Full local perimeter' },
	{ target: 'admin.lab.local:8088', profile: 'local-real' as const, label: 'Admin service' },
	{ target: 'legacy.lab.local:8088', profile: 'local-real' as const, label: 'Legacy service' },
	{ target: 'files.lab.local:8088', profile: 'local-real' as const, label: 'File service' },
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
): ScanStep[] {
	const scanStarted = scan !== null;
	const scanFinished = ['completed', 'failed', 'cancelled'].includes(scan?.status ?? '');
	const hasAssets = assets.length > 0 || scanFinished;
	const hasFindings = findings.length > 0 || scanFinished;
	const currentStage = scan?.current_stage ?? 'starting';
	const activeStepIndex = scan?.status === 'created'
		? 0
		: scan?.status === 'running'
			? ['starting', 'discovery', 'probing'].includes(currentStage)
				? 1
				: ['nuclei', 'service_detection'].includes(currentStage)
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
	report: RiskReportResponse | null = null,
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

	if (scan.status === 'cancelled') {
		return { percent: scan.progress_percent ?? 0, label: 'Cancelled', detail: 'Stopped by operator', isActive: false };
	}

	if (scan.status === 'created') {
		return {
			percent: 8,
			label: 'Queued',
			detail: 'Waiting for worker',
			isActive: true,
		};
	}

	const labels: Record<string, [string, string]> = {
		starting: ['Starting', 'Preparing authorized scan'],
		discovery: ['Discovery', 'Enumerating target surface'],
		probing: ['HTTP probing', 'Checking reachable web services'],
		nuclei: ['Nuclei checks', 'Running bounded exposure templates'],
		service_detection: ['Service detection', 'Collecting permitted service metadata'],
		reporting: ['Report', 'Compiling evidence and recommendations'],
		cancelling: ['Cancelling', 'Waiting for the current scanner command to stop'],
	};
	const stage = scan.current_stage ?? 'starting';
	const [label, detail] = labels[stage] ?? ['Running', stage];
	return { percent: scan.progress_percent ?? 5, label, detail, isActive: true };
}

function getRiskScore(findings: FindingResponse[] = []) {
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
		case 'cancelled':
			return 'Cancelled';
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
		case 'cancelled':
			return 'Scan cancelled';
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
