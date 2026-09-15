import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { gsap } from 'gsap';
import { Check, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Header } from '../../Header/Header';
import { MetricsGrid } from '../../MetricsGrid/MetricsGrid';
import { StartScan } from '../../StartScan/StartScan';
import { ApiError, getApiErrorMessage } from '../../shared/api/client';
import {
	getScan,
	getScanAssets,
	getScanFindings,
	getScanReport,
	listScans,
	cancelScan,
	startScan,
	type ScanResponse,
} from '../../shared/api/scans';
import {
	buildMetrics,
	buildScanProgress,
	buildScanSteps,
	formatScanStatus,
	formatStatusHeadline,
	formatStatusMeta,
	formatUtcTimestamp,
} from '../../types/dashboard';
import styles from './Dashboard.module.scss';
import { ScanDropdown } from '../../shared/ui/ScanDropdown';

export function Dashboard() {
	const queryClient = useQueryClient();
	const dashboardRef = useRef<HTMLElement>(null);
	const [selectedScanId, setSelectedScanId] = useState<string | null>(null);

	const scansQuery = useQuery({
		queryKey: ['scans', { limit: 20 }],
		queryFn: () => listScans({ limit: 20, offset: 0 }),
		refetchInterval: 10000,
	});

	const scans = scansQuery.data?.items ?? [];
	const preferredScanId =
		scans.find((scan) => ['created', 'running'].includes(scan.status))?.id ??
		scans[0]?.id ??
		null;
	const activeScanId = selectedScanId ?? preferredScanId;

	const startScanMutation = useMutation({
		mutationFn: startScan,
		onSuccess: (scan) => {
			queryClient.setQueryData(['scan', scan.id], scan);
			setSelectedScanId(scan.id);
			void queryClient.invalidateQueries({ queryKey: ['scans'] });
		},
		onError: (error) => {
			const conflictingScanId = getConflictingScanId(error);
			if (!conflictingScanId) {
				return;
			}

			setSelectedScanId(conflictingScanId);
			void queryClient.invalidateQueries({ queryKey: ['scans'] });
			void queryClient.invalidateQueries({ queryKey: ['scan', conflictingScanId] });
		},
	});
	const cancelScanMutation = useMutation({
		mutationFn: cancelScan,
		onSuccess: (scan) => {
			queryClient.setQueryData(['scan', scan.id], scan);
			void queryClient.invalidateQueries({ queryKey: ['scans'] });
		},
	});

	const scanQuery = useQuery({
		queryKey: ['scan', activeScanId],
		queryFn: () => getScan(activeScanId!),
		enabled: activeScanId !== null,
		refetchInterval: (query) => {
			const scan = query.state.data as ScanResponse | undefined;
			return !scan || scan.status === 'created' || scan.status === 'running' ? 2000 : false;
		},
	});

	const currentScan = scanQuery.data ?? null;
	const currentScanId = currentScan?.id;
	const currentScanStatus = currentScan?.status;
	const shouldPollCollections =
		currentScanStatus === 'created' || currentScanStatus === 'running';

	const assetsQuery = useQuery({
		queryKey: ['scan-assets', activeScanId],
		queryFn: () => getScanAssets(activeScanId!, { limit: 200, offset: 0 }),
		enabled: activeScanId !== null,
		refetchInterval: shouldPollCollections ? 2000 : false,
	});

	const findingsQuery = useQuery({
		queryKey: ['scan-findings', activeScanId],
		queryFn: () => getScanFindings(activeScanId!, { limit: 200, offset: 0 }),
		enabled: activeScanId !== null,
		refetchInterval: shouldPollCollections ? 2000 : false,
	});

	const reportQuery = useQuery({
		queryKey: ['scan-report', activeScanId],
		queryFn: () => getScanReport(activeScanId!),
		enabled: activeScanId !== null && currentScan?.status === 'completed',
		retry: false,
	});

	const assets = assetsQuery.data?.items ?? [];
	const findings = findingsQuery.data?.items ?? [];
	const report = reportQuery.data ?? null;
	const metrics = buildMetrics(assets, findings, report);
	const dashboardMetrics = metrics.filter((metric) => metric.label !== 'Live Hosts');
	const scanSteps = buildScanSteps(currentScan, assets, findings, report);
	const scanProgress = buildScanProgress(currentScan, report);
	const activeQueueCount =
		scans.filter((scan) => scan.status === 'created' || scan.status === 'running').length;
	const statusBadgeLabel = scanQuery.isError
		? 'Error'
		: formatScanStatus(currentScan?.status ?? null);
	const statusHeadline = scanQuery.isPending
		? 'Loading selected scan...'
		: formatStatusHeadline(currentScan);
	const statusMeta = scanQuery.isError
		? getApiErrorMessage(scanQuery.error)
		: formatStatusMeta(currentScan, assets.length, findings.length, report);
	const modeInfo = buildModeInfo(currentScan);
	const isActiveScan = currentScan?.status === 'created' || currentScan?.status === 'running';
	const startScanErrorMessage = startScanMutation.isError
		? formatStartScanError(startScanMutation.error)
		: null;

	useEffect(() => {
		if (!currentScanId || !currentScanStatus || !['completed', 'failed', 'cancelled'].includes(currentScanStatus)) {
			return;
		}

		void queryClient.invalidateQueries({ queryKey: ['scan-assets', currentScanId] });
		void queryClient.invalidateQueries({ queryKey: ['scan-findings', currentScanId] });
		if (currentScanStatus === 'completed') {
			void queryClient.invalidateQueries({ queryKey: ['scan-report', currentScanId] });
		}
	}, [currentScanId, currentScanStatus, queryClient]);

	useLayoutEffect(() => {
		const root = dashboardRef.current;
		if (!root || prefersReducedMotion()) {
			return;
		}

		const context = gsap.context(() => {
			const timeline = gsap.timeline({ defaults: { ease: 'power3.out' } });
			timeline.from('[data-gsap="intro"]', {
				autoAlpha: 0,
				y: 18,
				duration: 0.58,
				stagger: 0.08,
			});
			timeline.from(
				'[data-gsap="result-card"]',
				{
					autoAlpha: 0,
					y: 22,
					duration: 0.5,
					stagger: 0.07,
				},
				'-=0.24',
			);
		}, root);

		return () => context.revert();
	}, []);

	useLayoutEffect(() => {
		const root = dashboardRef.current;
		if (!root || !activeScanId || prefersReducedMotion()) {
			return;
		}

		const context = gsap.context(() => {
			gsap.fromTo(
				'[data-gsap-scan-detail="true"]',
				{ autoAlpha: 0.76, y: 8 },
				{
					autoAlpha: 1,
					y: 0,
					duration: 0.36,
					stagger: 0.045,
					ease: 'power2.out',
				},
			);
		}, root);

		return () => context.revert();
	}, [activeScanId, currentScanStatus]);

	return (
		<main ref={dashboardRef} className={styles.dashboard}>
				<div data-gsap="intro">
					<Header />
				</div>

				<section className={styles.heroGrid} data-gsap="intro">
					<StartScan
						activeQueueCount={activeQueueCount}
						errorMessage={startScanErrorMessage}
						isSubmitting={startScanMutation.isPending}
						onSubmit={async (payload) => {
							await startScanMutation.mutateAsync(payload);
						}}
					/>

					<article
						className={`${styles.statusPanel} ${
							isActiveScan ? styles.activeStatusPanel : styles.settledStatusPanel
						}`}
					>
						<div className={styles.statusHeader}>
							<div>
								<p className={styles.sectionEyebrow}>Execution status</p>
								<h2>{statusHeadline}</h2>
								<p className={styles.statusMeta}>{statusMeta}</p>
							</div>
							<span
								className={`${styles.statusBadge} ${
									scanQuery.isError
										? styles.failed
										: currentScan
											? styles[currentScan.status]
											: styles.idleStatus
								}`}
							>
								{statusBadgeLabel}
							</span>
						</div>

						<div className={`${styles.modeRow} ${styles[modeInfo.tone]}`}>
							<span>{modeInfo.label}</span>
							<p>{modeInfo.description}</p>
						</div>

						<div className={styles.progressBlock} aria-live="polite">
							<div className={styles.progressMeta}>
								<span>{scanProgress.label}</span>
								<strong>{scanProgress.percent}%</strong>
							</div>
							<div className={styles.progressTrack}>
								<span style={{ width: `${scanProgress.percent}%` }} />
							</div>
							<p>{scanProgress.detail}</p>
						</div>
						{currentScan && ['created', 'running'].includes(currentScan.status) ? (
							<button
								type="button"
								className={styles.cancelButton}
								disabled={cancelScanMutation.isPending || currentScan.cancellation_requested}
								onClick={() => cancelScanMutation.mutate(currentScan.id)}
							>
								{currentScan.cancellation_requested ? 'Cancellation requested' : 'Cancel scan'}
							</button>
						) : null}

						<div className={styles.steps}>
							{scanSteps.map((step, index) => (
								<div key={step.title} className={styles.stepItem}>
									<span
										className={`${styles.stepDot} ${
											step.completed ? styles.stepDone : styles.stepPending
										}`}
									>
										{step.completed ? <Check size={15} /> : index + 1}
									</span>
									<p className={styles.stepTitle}>{step.title}</p>
								</div>
							))}
						</div>
					</article>
				</section>

				<div className={styles.motionBlock} data-gsap="intro">
					<MetricsGrid metrics={dashboardMetrics} />
				</div>

				<section className={styles.detailsGrid}>
					<article
						className={`${styles.panel} ${styles.scanSelectorPanel}`}
						data-gsap="result-card"
						data-gsap-scan-detail="true"
					>
						<div className={styles.panelHeader}>
							<div>
								<p className={styles.sectionEyebrow}>Scan results</p>
								<h3>Selected scan</h3>
							</div>
							<div className={styles.panelHeaderActions}>
								<span className={styles.panelMeta}>{scans.length} recent</span>
								{activeScanId ? (
									<Link
										to={`/scans/${activeScanId}`}
										className={styles.scanOpenLink}
										title="Open scan workspace"
										aria-label="Open selected scan workspace"
									>
										<ExternalLink size={15} />
									</Link>
								) : null}
							</div>
						</div>

						<div className={styles.selectField}>
							<span>Choose from latest scans</span>
							<ScanDropdown
								scans={scans}
								selectedId={activeScanId}
								onChange={setSelectedScanId}
								isLoading={scansQuery.isPending}
							/>
						</div>

						{scansQuery.isError ? (
							<p className={styles.errorBox}>{getApiErrorMessage(scansQuery.error)}</p>
						) : null}

						<div className={styles.scanInfoGrid}>
							<InfoItem label="Target" value={currentScan?.target ?? 'No scan selected'} />
							<InfoItem label="Status" value={formatScanStatus(currentScan?.status ?? null)} />
							<InfoItem label="Profile" value={formatScanProfile(currentScan?.scan_profile)} />
							<InfoItem label="Created" value={formatNullableDate(currentScan?.created_at)} />
							<InfoItem label="Started" value={formatNullableDate(currentScan?.started_at)} />
							<InfoItem label="Finished" value={formatNullableDate(currentScan?.finished_at)} />
						</div>

						{currentScan?.status === 'failed' ? (
							<div className={styles.errorBox}>
								<strong>Failure reason</strong>
								<span>{currentScan.error_message ?? 'Scan failed before the backend returned details.'}</span>
							</div>
						) : null}
					</article>
				</section>
		</main>
	);
}

function InfoItem({ label, value }: { label: string; value: string }) {
	return (
		<div className={styles.infoItem}>
			<span>{label}</span>
			<strong>{value}</strong>
		</div>
	);
}

function formatNullableDate(value: string | null | undefined) {
	return value ? formatUtcTimestamp(value) : 'Not set';
}

function formatScanProfile(value: ScanResponse['scan_profile'] | undefined) {
	switch (value) {
		case 'discovery':
			return 'Discovery';
		case 'safe':
			return 'Safe';
		case 'lab':
			return 'LAB_MODE';
		case 'local-real':
			return 'Local real';
		default:
			return 'Not selected';
	}
}

function formatStartScanError(error: unknown) {
	const conflictingScanId = getConflictingScanId(error);
	if (conflictingScanId) {
		return `${getApiErrorMessage(error)} Selected the existing active scan.`;
	}

	return getApiErrorMessage(error);
}

function getConflictingScanId(error: unknown) {
	if (!(error instanceof ApiError) || error.status !== 409 || !isRecord(error.details)) {
		return null;
	}

	const scanId = error.details.scan_id;
	return typeof scanId === 'string' ? scanId : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function prefersReducedMotion() {
	return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function buildModeInfo(scan: ScanResponse | null) {
	if (scan?.scan_profile === 'local-real') {
		return {
			label: 'Local real scanners',
			description: 'Real httpx and Nuclei against an allowlisted local target.',
			tone: 'modeReal',
		};
	}
	if (scan?.scan_profile === 'lab') {
		return {
			label: 'LAB_MODE',
			description: 'Safe HTTP validation without external scanner binaries.',
			tone: 'modeLab',
		};
	}

	if (import.meta.env.VITE_ENABLE_REAL_SCANNERS === 'true') {
		return {
			label: 'Real scanners',
			description: 'Real scanners against an authorized allowlisted domain.',
			tone: 'modeReal',
		};
	}

	return {
		label: 'Demo data',
		description: 'Simulated scanner results for product-flow validation.',
		tone: 'modeDemo',
	};
}
