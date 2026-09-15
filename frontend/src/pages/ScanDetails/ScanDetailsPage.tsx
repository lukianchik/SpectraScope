import { useState } from 'react';
import { ArrowLeft, Boxes, CheckCircle2, ChevronDown, ChevronUp, CircleDashed, Download, FileText, RefreshCw, StopCircle, Trash2, TriangleAlert, XCircle } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Header } from '../../Header/Header';
import { MetricsGrid } from '../../MetricsGrid/MetricsGrid';
import { getApiErrorMessage } from '../../shared/api/client';
import type { FindingResponse, RiskReportResponse, ScanResponse, StageDiagnostic } from '../../shared/api/scans';
import {
	useCancelScan,
	useDeleteScan,
	useScan,
	useScanAssets,
	useScanFindings,
	useScanReport,
} from '../../shared/hooks/useScansData';
import { formatScanCode } from '../../shared/lib/scanLabels';
import { buildMetrics, buildScanProgress, formatUtcTimestamp } from '../../types/dashboard';
import s from '../_shared/pageStyles.module.scss';
import styles from './ScanDetailsPage.module.scss';

export function ScanDetailsPage() {
	const { scanId = '' } = useParams<{ scanId: string }>();
	const navigate = useNavigate();
	const scanQuery = useScan(scanId || null);
	const scan = scanQuery.data ?? null;
	const assetsQuery = useScanAssets(scan?.id ?? null, scan?.status);
	const findingsQuery = useScanFindings(scan?.id ?? null, scan?.status);
	const reportQuery = useScanReport(scan?.id ?? null, scan?.status);
	const cancelMutation = useCancelScan();
	const deleteMutation = useDeleteScan();
	const assets = assetsQuery.data?.items ?? [];
	const findings = findingsQuery.data?.items ?? [];
	const report = reportQuery.data ?? null;
	const metrics = buildMetrics(assets, findings, report).filter((metric) => metric.label !== 'Live Hosts');
	const progress = buildScanProgress(scan, report);
	const isActive = scan?.status === 'created' || scan?.status === 'running';

	if (scanQuery.isPending) {
		return <div className={styles.state}>Loading scan...</div>;
	}

	if (scanQuery.isError || !scan) {
		return (
			<div className={styles.state}>
				<TriangleAlert size={24} />
				<strong>Scan could not be loaded</strong>
				<span>{scanQuery.isError ? getApiErrorMessage(scanQuery.error) : 'Unknown scan identifier.'}</span>
				<Link to="/scans" className={s.btnGhost}><ArrowLeft size={14} /> Back to scans</Link>
			</div>
		);
	}

	return (
		<>
			<Header
				eyebrow="Scan workspace"
				title={formatScanCode(scan.id)}
				subtitle={scan.target}
				right={
					<div className={styles.headerActions}>
						<Link to="/scans" className={s.btnGhost}><ArrowLeft size={14} /> Scans</Link>
						<button type="button" className={s.btnGhost} onClick={() => void scanQuery.refetch()}>
							<RefreshCw size={14} className={scanQuery.isFetching ? 'spin' : ''} /> Refresh
						</button>
						{!isActive ? (
							<button
								type="button"
								className={`${s.btnGhost} ${s.iconDanger}`}
								disabled={deleteMutation.isPending}
								onClick={() => {
									if (window.confirm(`Delete ${formatScanCode(scan.id)} for ${scan.target}?`)) {
										deleteMutation.mutate(scan.id, { onSuccess: () => navigate('/scans') });
									}
								}}
							>
								<Trash2 size={14} /> Delete
							</button>
						) : null}
					</div>
				}
			/>

			<section className={styles.execution}>
				<div className={styles.executionHead}>
					<div>
						<p className={styles.eyebrow}>Execution</p>
						<h2>{statusTitle(scan.status)}</h2>
					</div>
					<span className={`${s.statusPill} ${s[scan.status]}`}>
						<span className={s.dot} /> {scan.status}
					</span>
				</div>

				<dl className={styles.facts}>
					<Fact label="Target" value={scan.target} />
					<Fact label="Profile" value={scan.scan_profile} />
					<Fact label="Started" value={formatDate(scan.started_at ?? scan.created_at)} />
					<Fact label="Duration" value={formatDuration(scan)} />
				</dl>

				<div className={styles.progress} aria-live="polite">
					<div className={styles.progressMeta}>
						<span>{progress.label}</span>
						<strong>{progress.percent}%</strong>
					</div>
					<div className={styles.progressTrack}><span style={{ width: `${progress.percent}%` }} /></div>
					<p>{progress.detail}</p>
				</div>

				<StageTimeline diagnostics={scan.stage_diagnostics ?? []} />

				{scan.error_message ? <p className={styles.error}>{scan.error_message}</p> : null}
				{isActive ? (
					<button
						type="button"
						className={styles.cancelButton}
						disabled={cancelMutation.isPending || scan.cancellation_requested}
						onClick={() => cancelMutation.mutate(scan.id)}
					>
						<StopCircle size={16} />
						{scan.cancellation_requested ? 'Cancellation requested' : 'Cancel scan'}
					</button>
				) : null}
				{deleteMutation.isError ? <p className={styles.error}>{getApiErrorMessage(deleteMutation.error)}</p> : null}
			</section>

			<MetricsGrid metrics={metrics} />

			<section className={styles.resultsGrid}>
				<ResultPanel
					eyebrow="Inventory"
					title="Discovered assets"
					count={`${assets.length} total`}
					link={`/assets?scan=${scan.id}`}
					icon={<Boxes size={17} />}
				>
					{assetsQuery.isError ? (
						<PanelError error={assetsQuery.error} />
					) : assets.length ? (
						<ul className={styles.assetList}>
							{assets.slice(0, 6).map((asset) => (
								<li key={asset.id}>
									<div><strong>{asset.hostname}</strong><span>{asset.ip ?? 'Unresolved'} / {asset.title ?? 'No title'}</span></div>
									<code>{asset.http_status ?? (asset.is_alive ? 'LIVE' : 'DARK')}</code>
								</li>
							))}
						</ul>
					) : (
						<EmptyResult active={isActive} label="assets" />
					)}
				</ResultPanel>

				<ResultPanel
					eyebrow="Risk"
					title="Scanner findings"
					count={`${findings.length} total`}
					link={`/findings?scan=${scan.id}`}
					icon={<TriangleAlert size={17} />}
				>
					{findingsQuery.isError ? (
						<PanelError error={findingsQuery.error} />
					) : findings.length ? (
						<ul className={styles.findingList}>
							{findings.slice(0, 6).map((finding) => <FindingPreview key={finding.id} finding={finding} />)}
						</ul>
					) : (
						<EmptyResult active={isActive} label="findings" />
					)}
				</ResultPanel>
			</section>

			<section className={styles.reportPanel}>
				<div className={styles.panelHead}>
					<div>
						<p className={styles.eyebrow}>Defensive synthesis</p>
						<h2>Risk report</h2>
					</div>
					<div className={styles.panelActions}>
						{report ? (
							<button type="button" className={s.iconLink} title="Export report" aria-label="Export report" onClick={() => downloadReport(scan, report)}>
								<Download size={15} />
							</button>
						) : null}
						<Link to={`/reports?scan=${scan.id}`} className={s.btnGhost}><FileText size={14} /> Full report</Link>
					</div>
				</div>
				{reportQuery.isError ? (
					<PanelError error={reportQuery.error} />
				) : report ? (
					<div className={styles.reportContent}>
						<div>
							<p className={styles.summary}>{report.summary}</p>
							<ul className={styles.riskPreview}>
								{report.top_risks.slice(0, 5).map((risk, index) => (
									<li key={`${String(risk.name ?? risk.risk)}-${index}`}>
										<span className={`${s.sev} ${s[String(risk.severity ?? 'info')]}`}>{String(risk.severity ?? 'info')}</span>
										<strong>{String(risk.name ?? risk.risk ?? 'Risk item')}</strong>
										<small>{String(risk.affected_assets ?? risk.assets ?? 1)} assets</small>
									</li>
								))}
							</ul>
						</div>
						<div>
							<h3>Priority actions</h3>
							<ol>{report.recommendations.slice(0, 5).map((item) => <li key={item}>{item}</li>)}</ol>
						</div>
					</div>
				) : (
					<EmptyResult active={isActive} label="report" />
				)}
			</section>
		</>
	);
}

function StageTimeline({ diagnostics }: { diagnostics: StageDiagnostic[] }) {
	return (
		<section className={styles.timeline} aria-label="Scanner execution timeline">
			<div className={styles.timelineHead}>
				<p className={styles.eyebrow}>Stage diagnostics</p>
				<span>{diagnostics.length} stages</span>
			</div>
			{diagnostics.length ? (
				<ul>
					{diagnostics.map((diagnostic) => (
						<li key={diagnostic.stage} data-status={diagnostic.status}>
							<span className={styles.stageIcon}>{stageIcon(diagnostic.status)}</span>
							<div className={styles.stageIdentity}>
								<strong>{formatStageName(diagnostic.stage)}</strong>
								<span>{diagnostic.tool}</span>
							</div>
							<div className={styles.stageNumbers}>
								<span>{diagnostic.target_count ?? '--'} targets</span>
								<span>{diagnostic.result_count ?? '--'} results</span>
								<span>{formatStageDuration(diagnostic.duration_ms)}</span>
								<span>exit {diagnostic.exit_code ?? '--'}</span>
							</div>
							{diagnostic.error ? <p>{diagnostic.error}</p> : null}
						</li>
					))}
				</ul>
			) : (
				<p className={styles.timelineEmpty}>No persisted stage diagnostics for this scan.</p>
			)}
		</section>
	);
}

function stageIcon(status: StageDiagnostic['status']) {
	if (status === 'completed') return <CheckCircle2 size={17} />;
	if (status === 'failed') return <XCircle size={17} />;
	return <CircleDashed size={17} className="spin" />;
}

function formatStageName(value: string) {
	return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatStageDuration(value: number | null) {
	if (value === null) return 'running';
	if (value < 1_000) return `${value}ms`;
	return `${(value / 1_000).toFixed(1)}s`;
}

function FindingPreview({ finding }: { finding: FindingResponse }) {
	const [isOpen, setIsOpen] = useState(false);
	const request = evidenceValue(finding.raw_json, 'request');
	const response = evidenceValue(finding.raw_json, 'response');

	return (
		<li className={isOpen ? styles.findingOpen : undefined}>
			<button type="button" className={styles.findingButton} onClick={() => setIsOpen((value) => !value)} aria-expanded={isOpen}>
				<span className={`${s.sev} ${s[finding.severity]}`}>{finding.severity}</span>
				<div><strong>{finding.name}</strong><span>{finding.source_tool} / {finding.matched_at ?? 'No matched URL'}</span></div>
				<code>{finding.cvss?.toFixed(1) ?? '--'}</code>
				{isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
			</button>
			{isOpen ? (
				<div className={styles.findingEvidence}>
					<p>{finding.description ?? 'No description returned by the scanner.'}</p>
					<div className={styles.evidenceGrid}>
						<Evidence title="Request" value={request ?? 'Request was not returned by the scanner.'} />
						<Evidence title="Response" value={response ?? 'Response was not returned by the scanner.'} />
					</div>
					<details>
						<summary>Scanner metadata</summary>
						<pre>{formatEvidenceMetadata(finding.raw_json)}</pre>
					</details>
				</div>
			) : null}
		</li>
	);
}

function Evidence({ title, value }: { title: string; value: string }) {
	return <article><h3>{title}</h3><pre>{value}</pre></article>;
}

function evidenceValue(raw: Record<string, unknown> | null, key: string) {
	const value = raw?.[key];
	return typeof value === 'string' && value.trim() ? value : null;
}

function formatEvidenceMetadata(raw: Record<string, unknown> | null) {
	if (!raw) return 'No scanner metadata returned.';
	return JSON.stringify(
		Object.fromEntries(Object.entries(raw).filter(([key]) => !['request', 'response', 'template', 'template-encoded'].includes(key))),
		null,
		2,
	);
}

function ResultPanel({ eyebrow, title, count, link, icon, children }: {
	eyebrow: string;
	title: string;
	count: string;
	link: string;
	icon: React.ReactNode;
	children: React.ReactNode;
}) {
	return (
		<article className={styles.resultPanel}>
			<div className={styles.panelHead}>
				<div><p className={styles.eyebrow}>{eyebrow}</p><h2>{title}</h2></div>
				<div className={styles.panelActions}>
					<span className={styles.count}>{count}</span>
					<Link to={link} className={s.iconLink} title={`Open ${title}`} aria-label={`Open ${title}`}>{icon}</Link>
				</div>
			</div>
			{children}
		</article>
	);
}

function Fact({ label, value }: { label: string; value: string }) {
	return <div><dt>{label}</dt><dd>{value}</dd></div>;
}

function EmptyResult({ active, label }: { active: boolean; label: string }) {
	return <p className={styles.empty}>{active ? `Waiting for ${label}...` : `No ${label} produced by this scan.`}</p>;
}

function PanelError({ error }: { error: unknown }) {
	return <p className={styles.error}>{getApiErrorMessage(error)}</p>;
}

function formatDate(value: string | null) {
	return value ? formatUtcTimestamp(value) : 'Not started';
}

function formatDuration(scan: ScanResponse) {
	if (!scan.started_at) return 'Not started';
	const end = scan.finished_at ? new Date(scan.finished_at).getTime() : Date.now();
	const seconds = Math.max(0, Math.round((end - new Date(scan.started_at).getTime()) / 1000));
	if (seconds < 60) return `${seconds}s`;
	return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function statusTitle(status: ScanResponse['status']) {
	const titles: Record<ScanResponse['status'], string> = {
		created: 'Waiting for scanner worker',
		running: 'Authorized scan in progress',
		completed: 'Scan completed',
		failed: 'Scan failed',
		cancelled: 'Scan cancelled',
	};
	return titles[status];
}

function downloadReport(scan: ScanResponse, report: RiskReportResponse) {
	const blob = new Blob([JSON.stringify({ scan, report }, null, 2)], { type: 'application/json' });
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement('a');
	anchor.href = url;
	anchor.download = `spectrascope-${formatScanCode(scan.id)}-report.json`;
	anchor.click();
	URL.revokeObjectURL(url);
}
