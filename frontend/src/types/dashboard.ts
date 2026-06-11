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
}

export const metrics: Metric[] = [
	{
		label: 'Total Assets',
		value: '128',
		delta: '+12%',
		caption: 'vs last scan',
		tone: 'accent',
	},
	{
		label: 'Live Hosts',
		value: '96',
		delta: '+8%',
		caption: 'reachable now',
		tone: 'success',
	},
	{
		label: 'Findings',
		value: '243',
		delta: '+18%',
		caption: 'open issues',
		tone: 'warning',
	},
	{
		label: 'Critical Findings',
		value: '12',
		delta: '+33%',
		caption: 'needs triage',
		tone: 'critical',
	},
	{
		label: 'Risk Score',
		value: '78 / 100',
		delta: 'High',
		caption: 'attack surface posture',
		tone: 'neutral',
		progress: 78,
	},
];

export const riskBreakdown: RiskBreakdownItem[] = [
	{ label: 'Critical', value: 12, percent: 5, tone: 'critical' },
	{ label: 'High', value: 45, percent: 18, tone: 'high' },
	{ label: 'Medium', value: 83, percent: 34, tone: 'medium' },
	{ label: 'Low', value: 67, percent: 28, tone: 'low' },
	{ label: 'Info', value: 36, percent: 15, tone: 'info' },
];

export const trendSeries: TrendPoint[] = [
	{ label: 'May 12', value: 48 },
	{ label: 'May 19', value: 104 },
	{ label: 'May 26', value: 146 },
	{ label: 'Jun 2', value: 168 },
	{ label: 'Jun 9', value: 214 },
	{ label: 'Jun 16', value: 243 },
];

export const riskyAssets: RiskyAsset[] = [
	{ name: 'admin.example.com', ip: '203.0.113.10', score: 92, status: 'Critical' },
	{ name: 'api.example.com', ip: '203.0.113.20', score: 88, status: 'Monitored' },
	{ name: 'dev.example.com', ip: '203.0.113.30', score: 75, status: 'Watchlist' },
	{ name: 'shop.example.com', ip: '203.0.113.40', score: 72, status: 'Monitored' },
	{ name: 'vpn.example.com', ip: '203.0.113.50', score: 67, status: 'Watchlist' },
];

export const recentScans: ScanRecord[] = [
	{
		target: 'example.com',
		profile: 'Full Scan',
		status: 'Completed',
		assets: 128,
		findings: 243,
		riskScore: 78,
		finishedAt: 'Jun 17, 14:32',
	},
	{
		target: 'portal.example.com',
		profile: 'Quick Scan',
		status: 'Running',
		assets: 46,
		findings: 19,
		riskScore: 55,
		finishedAt: 'Jun 17, 12:08',
	},
	{
		target: 'acme.io',
		profile: 'Full Scan',
		status: 'Completed',
		assets: 98,
		findings: 188,
		riskScore: 65,
		finishedAt: 'Jun 15, 16:44',
	},
	{
		target: 'staging.example.com',
		profile: 'Discovery',
		status: 'Failed',
		assets: 0,
		findings: 0,
		riskScore: 0,
		finishedAt: 'Jun 15, 09:21',
	},
];

export const topFindings: FindingRecord[] = [
	{
		severity: 'critical',
		title: 'CVE-2024-48788',
		description: 'Apache Struts RCE vulnerability',
		count: 3,
	},
	{
		severity: 'critical',
		title: 'CVE-2023-3519',
		description: 'Citrix NetScaler unauthenticated RCE',
		count: 2,
	},
	{
		severity: 'high',
		title: 'Directory listing enabled',
		description: 'Public file indexes expose internal assets',
		count: 12,
	},
	{
		severity: 'medium',
		title: 'Missing security headers',
		description: 'CSP, HSTS, and X-Frame-Options absent',
		count: 18,
	},
];

export const scanSteps: ScanStep[] = [
	{ title: 'Subdomains', subtitle: '120 found', completed: true },
	{ title: 'Live Hosts', subtitle: '24 live', completed: true },
	{ title: 'Findings', subtitle: '15 flagged', completed: true },
	{ title: 'Report', subtitle: 'Generated', completed: true },
];

export const recommendations = [
	'Secure or remove the exposed admin panel on admin.example.com.',
	'Roll out baseline headers and TLS hardening across internet-facing hosts.',
	'Patch legacy services, then re-scan high-risk assets to validate remediation.',
];
