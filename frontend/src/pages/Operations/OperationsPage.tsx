import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
	Activity,
	Ban,
	Check,
	CircleAlert,
	Crosshair,
	Database,
	GitBranch,
	LockKeyhole,
	Play,
	RotateCcw,
	Server,
	ShieldCheck,
	Square,
	Terminal,
} from 'lucide-react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { Header } from '../../Header/Header';
import { useAdversaryMode } from '../../shared/adversary/useAdversaryMode';
import type { AssetResponse, FindingResponse, Severity } from '../../shared/api/scans';
import {
	createOperation,
	listOperations,
	transitionOperation,
	type OperationAction,
	type OperationEventResponse,
	type OperationResponse,
} from '../../shared/api/operations';
import { getApiErrorMessage } from '../../shared/api/client';
import { useScanAssets, useScanFindings, useScansList } from '../../shared/hooks/useScansData';
import { formatScanCode } from '../../shared/lib/scanLabels';
import { ScanSelector } from '../../shared/ui/ScanSelector';
import styles from './OperationsPage.module.scss';
import { useLanguage } from '../../shared/i18n/useLanguage';

type RuntimeStatus = 'idle' | 'running' | 'gate' | 'completed' | 'aborted';

const phases = [
	{ name: 'Evidence ingest', detail: 'Load immutable scanner observations' },
	{ name: 'Surface mapping', detail: 'Place reachable assets on the operation graph' },
	{ name: 'Exposure correlation', detail: 'Attach normalized findings to observed services' },
	{ name: 'Path simulation', detail: 'Model plausible movement without executing actions' },
	{ name: 'Defensive synthesis', detail: 'Identify where the modeled route should be broken' },
];

const severityRank: Record<Severity, number> = { critical: 5, high: 4, medium: 3, low: 2, info: 1 };

export function OperationsPage() {
	const { active } = useAdversaryMode();
	const { t } = useLanguage();
	const scansQuery = useScansList();
	const [searchParams, setSearchParams] = useSearchParams();
	const scans = scansQuery.data?.items.filter((scan) => scan.status === 'completed') ?? [];
	const selected = scans.find((scan) => scan.id === searchParams.get('scan')) ?? scans[0] ?? null;
	const assetsQuery = useScanAssets(selected?.id ?? null, selected?.status);
	const findingsQuery = useScanFindings(selected?.id ?? null, selected?.status);
	const operationsQuery = useQuery({
		queryKey: ['operations', selected?.id],
		queryFn: () => listOperations(selected!.id),
		enabled: selected !== null,
	});
	const latestOperation = operationsQuery.data?.items[0] ?? null;

	if (!active) return <Navigate to="/dashboard" replace />;

	return (
		<>
			<Header
				eyebrow={t('Controlled operation', 'Контролируемая операция')}
				title={t('Operation Center', 'Центр операций')}
				subtitle={t('Replay real scanner evidence as a staged adversary simulation with a mandatory human decision before path modeling.', 'Пошаговая симуляция по реальным данным сканера с обязательным решением человека перед моделированием цепочки.')}
				right={<span className={styles.safety}><LockKeyhole size={14} /> {t('Simulation only', 'Только симуляция')}</span>}
			/>

			<ScanSelector
				scans={scans}
				selectedId={selected?.id ?? null}
				isLoading={scansQuery.isPending}
				onChange={(scanId) => setSearchParams({ scan: scanId }, { replace: true })}
			/>

			{selected ? (
				<OperationRuntime
					key={`${selected.id}:${latestOperation?.id ?? 'new'}`}
					scanId={selected.id}
					target={selected.target}
					scanCode={formatScanCode(selected.id)}
					assets={assetsQuery.data?.items ?? []}
					findings={findingsQuery.data?.items ?? []}
					initialOperation={latestOperation}
					loading={assetsQuery.isPending || findingsQuery.isPending || operationsQuery.isPending}
				/>
			) : (
				<section className={styles.empty}><CircleAlert size={22} /><h2>No completed evidence set</h2><p>Run an authorized scan before starting an operation.</p></section>
			)}
		</>
	);
}

function OperationRuntime({ scanId, target, scanCode, assets, findings, initialOperation, loading }: {
	scanId: string;
	target: string;
	scanCode: string;
	assets: AssetResponse[];
	findings: FindingResponse[];
	initialOperation: OperationResponse | null;
	loading: boolean;
}) {
	const [operation, setOperation] = useState<OperationResponse | null>(initialOperation);
	const [busy, setBusy] = useState(false);
	const [apiError, setApiError] = useState<string | null>(null);
	const { t } = useLanguage();
	const sortedFindings = useMemo(
		() => [...findings].sort((a, b) => severityRank[b.severity] - severityRank[a.severity]),
		[findings],
	);

	const status = operationStatus(operation);
	const phase = operationPhase(operation);

	useEffect(() => {
		if (!operation || operation.status !== 'running') return;
		const nextAction: OperationAction | null = {
			evidence_ingest: 'map_surface',
			surface_mapping: 'correlate_exposure',
			path_simulation: 'complete',
		}[operation.current_phase] as OperationAction | null ?? null;
		if (!nextAction) return;
		const timer = window.setTimeout(() => {
			setBusy(true);
			transitionOperation(operation.id, nextAction)
				.then((updated) => { setOperation(updated); setApiError(null); })
				.catch((error: unknown) => setApiError(getApiErrorMessage(error)))
				.finally(() => setBusy(false));
		}, operation.current_phase === 'path_simulation' ? 1350 : 950);
		return () => window.clearTimeout(timer);
	}, [operation]);

	const launch = async () => {
		setBusy(true);
		setApiError(null);
		try {
			let current = operation?.status === 'ready' ? operation : await createOperation(scanId);
			setOperation(current);
			current = await transitionOperation(current.id, 'start');
			setOperation(current);
		} catch (error) {
			setApiError(getApiErrorMessage(error));
		} finally {
			setBusy(false);
		}
	};
	const perform = async (action: OperationAction, confirmHuman = false) => {
		if (!operation) return;
		setBusy(true);
		setApiError(null);
		try { setOperation(await transitionOperation(operation.id, action, confirmHuman)); }
		catch (error) { setApiError(getApiErrorMessage(error)); }
		finally { setBusy(false); }
	};
	const progress = status === 'completed' ? 100 : Math.max(0, Math.round(((phase + (status === 'gate' ? 1 : 0)) / phases.length) * 100));
	const activeAssets = phase >= 1 ? assets : [];
	const visibleFindings = phase >= 2 ? sortedFindings : [];
	const events = buildEvents(operation?.events ?? []);

	return (
		<div className={styles.runtime}>
			<section className={styles.operationHeader}>
				<div>
					<p>{operation ? `OP-${operation.id.replace(/-/g, '').slice(0, 8).toUpperCase()}` : `OP-${scanCode.replace('SCN-', '')}`} / AUTHORIZED SIMULATION</p>
					<h2>{target}</h2>
				</div>
				<div className={styles.operationActions}>
					<span className={`${styles.state} ${styles[status]}`}><span />{status}</span>
					{status === 'idle' || status === 'aborted' || status === 'completed' ? (
						<button type="button" onClick={() => void launch()} disabled={loading || busy} data-testid="operation-primary-action">
							{status === 'idle' ? <Play size={15} /> : <RotateCcw size={15} />}
							{busy ? t('Synchronizing', 'Синхронизация') : status === 'idle' ? (loading ? t('Loading evidence', 'Загрузка данных') : t('Launch operation', 'Запустить операцию')) : t('Launch another', 'Запустить новую')}
						</button>
					) : (
						<button type="button" className={styles.abortButton} disabled={busy} onClick={() => void perform('abort')} data-testid="operation-abort"><Square size={14} /> {t('Abort simulation', 'Остановить симуляцию')}</button>
					)}
				</div>
			</section>
			{operation ? <p className={styles.scopeLine}><LockKeyhole size={13} /> {t('Exact scope', 'Точная область')}: <strong>{operation.scope_manifest.allowed_targets.join(', ')}</strong><span /> {t('Active actions disabled', 'Активные действия отключены')} <span /> {t('Expires', 'Действует до')} {formatOperationTime(operation.scope_manifest.expires_at)}</p> : null}
			{apiError ? <p className={styles.apiError} role="alert"><CircleAlert size={15} /> {apiError}</p> : null}

			<div className={styles.progress} aria-live="polite">
				<div><span>{phase >= 0 ? phases[Math.min(phase, phases.length - 1)].name : 'Ready for launch'}</span><strong>{progress}%</strong></div>
				<div className={styles.progressTrack}><span style={{ width: `${progress}%` }} /></div>
			</div>

			<section className={styles.phaseStrip} aria-label="Operation phases">
				{phases.map((item, index) => {
					const phaseState = index < phase || status === 'completed' ? 'done' : index === phase ? (status === 'gate' ? 'waiting' : 'active') : 'pending';
					return <div key={item.name} className={styles[phaseState]}><span>{index < phase || status === 'completed' ? <Check size={14} /> : index + 1}</span><p><strong>{t(item.name, phaseRussian(item.name))}</strong><small>{t(item.detail, phaseDetailRussian(item.name))}</small></p></div>;
				})}
			</section>

			{status === 'gate' ? (
				<section className={styles.humanGate}>
					<div><ShieldCheck size={23} /><p><span>{t('Human decision required', 'Требуется решение человека')}</span><strong>{t('Authorize path modeling from observed evidence?', 'Разрешить моделирование цепочки по наблюдаемым данным?')}</strong><small>{t('This advances a non-executing simulation. No request, exploit, payload, or credential action will be sent.', 'Продолжится только симуляция. Запросы, эксплойты, payload и действия с учётными данными отправляться не будут.')}</small></p></div>
					<div><button type="button" className={styles.deny} disabled={busy} onClick={() => void perform('abort')}><Ban size={15} /> {t('Abort', 'Остановить')}</button><button type="button" className={styles.approve} disabled={busy} data-testid="operation-approve" onClick={() => void perform('approve_path', true)}><Check size={15} /> {t('Approve simulation', 'Подтвердить симуляцию')}</button></div>
				</section>
			) : null}

			<div className={styles.consoleGrid}>
				<section className={styles.mapPanel}>
					<header><div><p>Live topology</p><h2>Observed attack surface</h2></div><span><Activity size={14} /> {activeAssets.length} nodes online</span></header>
					<div className={styles.topology}>
						<div className={`${styles.entryNode} ${phase >= 0 ? styles.nodeVisible : ''}`}><Crosshair size={20} /><span>ENTRY</span><strong>{target}</strong><small>OBSERVED SCOPE</small></div>
						<div className={styles.routeLine} data-active={phase >= 1} />
						<div className={styles.assetNodes}>
							{activeAssets.length ? activeAssets.slice(0, 8).map((asset, index) => {
								const assetFindings = visibleFindings.filter((finding) => finding.asset_id === asset.id);
								return <article key={asset.id} style={{ animationDelay: `${index * 90}ms` }}><div><Server size={17} /><span>OBSERVED</span></div><strong>{asset.hostname}</strong><small>{asset.ip ?? 'IP unresolved'} / HTTP {asset.http_status ?? 'n/a'}</small><p>{asset.technologies?.join(' / ') || asset.title || 'Technology not reported'}</p>{assetFindings.length ? <em>{assetFindings.length} exposure{assetFindings.length === 1 ? '' : 's'}</em> : null}</article>;
							}) : <div className={styles.mapStandby}><Crosshair size={20} /><span>{phase < 1 ? 'Topology awaiting surface mapping' : 'No live assets in evidence set'}</span></div>}
							{phase >= 3 && sortedFindings.length ? <div className={styles.objective}><Database size={18} /><span>MODELED OBJECTIVE</span><strong>Break the highest-risk route</strong><small>{sortedFindings[0].name}</small></div> : null}
						</div>
					</div>
				</section>

				<section className={styles.eventPanel}>
					<header><div><p>Operation feed</p><h2>Evidence stream</h2></div><Terminal size={17} /></header>
					<ol>
						{events.length ? events.map((event) => <li key={event.id}><time>{event.time}</time><span className={styles[event.kind]}>{event.kind}</span><p>{event.text}</p></li>) : <li className={styles.feedIdle}><Activity size={16} /><p>Launch the operation to replay this evidence set.</p></li>}
					</ol>
				</section>
			</div>

			<section className={styles.exposureBand}>
				<div><GitBranch size={18} /><span>Correlated exposures</span><strong>{visibleFindings.length}</strong></div>
				<div className={styles.exposureList}>{visibleFindings.length ? visibleFindings.slice(0, 6).map((finding) => <span key={finding.id} className={styles[finding.severity]}><b>{finding.severity}</b>{finding.name}</span>) : <em>Findings appear after evidence correlation.</em>}</div>
			</section>
		</div>
	);
}

function phaseRussian(name: string) {
	return { 'Evidence ingest': 'Загрузка данных', 'Surface mapping': 'Карта поверхности', 'Exposure correlation': 'Связь находок', 'Path simulation': 'Моделирование цепочки', 'Defensive synthesis': 'Защитные приоритеты' }[name] ?? name;
}

function phaseDetailRussian(name: string) {
	return { 'Evidence ingest': 'Загрузка неизменяемых наблюдений сканера', 'Surface mapping': 'Размещение доступных активов на карте', 'Exposure correlation': 'Привязка находок к наблюдаемым сервисам', 'Path simulation': 'Моделирование движения без выполнения действий', 'Defensive synthesis': 'Определение точек разрыва смоделированной цепочки' }[name] ?? name;
}

interface OperationEvent { id: string; time: string; kind: 'system' | 'observed' | 'modeled' | 'human'; text: string }

function buildEvents(events: OperationEventResponse[]): OperationEvent[] {
	if (!events.length) return [];
	const startedAt = new Date(events[0].created_at).getTime();
	return events.map((event) => {
		const elapsed = Math.max(0, Math.round((new Date(event.created_at).getTime() - startedAt) / 1000));
		const kind = ['system', 'observed', 'modeled', 'human'].includes(event.event_type)
			? event.event_type as OperationEvent['kind']
			: 'system';
		return {
			id: event.id,
			time: `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`,
			kind,
			text: event.message,
		};
	});
}

function operationStatus(operation: OperationResponse | null): RuntimeStatus {
	if (!operation) return 'idle';
	if (operation.status === 'ready') return 'idle';
	if (operation.status === 'awaiting_approval') return 'gate';
	return operation.status;
}

function operationPhase(operation: OperationResponse | null) {
	if (!operation) return -1;
	return {
		evidence_ingest: 0,
		surface_mapping: 1,
		exposure_correlation: 2,
		path_simulation: 3,
		defensive_synthesis: 4,
	}[operation.current_phase] ?? -1;
}

function formatOperationTime(value: string) {
	return new Intl.DateTimeFormat(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}
