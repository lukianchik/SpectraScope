import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Header } from '../../Header/Header';
import { MetricsGrid } from '../../MetricsGrid/MetricsGrid';
import { StartScan } from '../../StartScan/StartScan';
import { getApiErrorMessage } from '../../shared/api/client';
import {
	getScan,
	getScanAssets,
	getScanFindings,
	getScanReport,
	listScans,
	startScan,
	type ScanResponse,
} from '../../shared/api/scans';
import {
	buildMetrics,
	buildScanSteps,
	formatScanStatus,
	formatStatusHeadline,
	formatStatusMeta,
} from '../../types/dashboard';
import { Sidebar } from '../../widgets/Sidebar/Sidebar';
import styles from './Dashboard.module.scss';

export function Dashboard() {
	const queryClient = useQueryClient();
	const [activeScanId, setActiveScanId] = useState<string | null>(null);

	const scansQuery = useQuery({
		queryKey: ['scans', { limit: 20 }],
		queryFn: () => listScans({ limit: 20, offset: 0 }),
		refetchInterval: 10000,
	});

	useEffect(() => {
		if (activeScanId || !scansQuery.data?.items.length) {
			return;
		}

		const preferredScan =
			scansQuery.data.items.find((scan) => ['created', 'running'].includes(scan.status)) ??
			scansQuery.data.items[0];

		setActiveScanId(preferredScan.id);
	}, [activeScanId, scansQuery.data]);

	const startScanMutation = useMutation({
		mutationFn: startScan,
		onSuccess: (scan) => {
			queryClient.setQueryData(['scan', scan.id], scan);
			setActiveScanId(scan.id);
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
	const shouldPollCollections =
		currentScan?.status === 'created' || currentScan?.status === 'running';

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
	const scanSteps = buildScanSteps(currentScan, assets, findings, report);
	const activeQueueCount =
		scansQuery.data?.items.filter((scan) => scan.status === 'created' || scan.status === 'running')
			.length ?? 0;
	const statusBadgeLabel = scanQuery.isError
		? 'Error'
		: formatScanStatus(currentScan?.status ?? null);
	const statusHeadline = scanQuery.isPending
		? 'Loading selected scan...'
		: formatStatusHeadline(currentScan);
	const statusMeta = scanQuery.isError
		? getApiErrorMessage(scanQuery.error)
		: formatStatusMeta(currentScan, assets.length, findings.length, report);

	return (
		<div className={styles.shell}>
			<Sidebar />

			<main className={styles.dashboard}>
				<Header />

				<section className={styles.heroGrid}>
					<StartScan
						activeQueueCount={activeQueueCount}
						errorMessage={startScanMutation.isError ? getApiErrorMessage(startScanMutation.error) : null}
						isSubmitting={startScanMutation.isPending}
						onSubmit={async (payload) => {
							await startScanMutation.mutateAsync(payload);
						}}
					/>

					<article className={styles.statusPanel}>
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

						<div className={styles.steps}>
							{scanSteps.map((step, index) => (
								<div key={step.title} className={styles.stepItem}>
									<div className={styles.stepTrack}>
										<span
											className={`${styles.stepDot} ${
												step.completed ? styles.stepDone : styles.stepPending
											}`}
										>
											{step.completed ? '✓' : index + 1}
										</span>
										{index < scanSteps.length - 1 ? (
											<span className={styles.stepLine} />
										) : null}
									</div>
									<div>
										<p className={styles.stepTitle}>{step.title}</p>
										<p className={styles.stepSubtitle}>{step.subtitle}</p>
									</div>
								</div>
							))}
						</div>
					</article>
				</section>

				<MetricsGrid metrics={metrics} />
			</main>
		</div>
	);
}
