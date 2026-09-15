import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, CircleAlert, Cpu, GitBranch, LockKeyhole, Route, Shield, Sparkles } from 'lucide-react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { Header } from '../../Header/Header';
import { useAdversaryMode } from '../../shared/adversary/useAdversaryMode';
import type { FindingResponse, Severity } from '../../shared/api/scans';
import { useScanAssets, useScanFindings, useScansList } from '../../shared/hooks/useScansData';
import { ScanSelector } from '../../shared/ui/ScanSelector';
import styles from './AttackPathsPage.module.scss';
import { useLanguage } from '../../shared/i18n/useLanguage';
import { listPathReviews, updatePathReview } from '../../shared/api/workspace';

interface PathStep {
	id: string;
	phase: string;
	title: string;
	evidence: string;
	hypothesis: string;
	defensiveObjective: string;
	severity: Severity | 'context';
}

const severityOrder: Record<Severity, number> = { critical: 5, high: 4, medium: 3, low: 2, info: 1 };

export function AttackPathsPage() {
	const { active } = useAdversaryMode();
	const { t } = useLanguage();
	const scansQuery = useScansList();
	const [searchParams, setSearchParams] = useSearchParams();
	const scans = scansQuery.data?.items.filter((scan) => scan.status === 'completed') ?? [];
	const requestedId = searchParams.get('scan');
	const selected = scans.find((scan) => scan.id === requestedId) ?? scans[0] ?? null;
	const assetsQuery = useScanAssets(selected?.id ?? null, selected?.status);
	const findingsQuery = useScanFindings(selected?.id ?? null, selected?.status);
	const queryClient = useQueryClient();
	const reviewsQuery = useQuery({
		queryKey: ['path-reviews', selected?.id],
		queryFn: () => listPathReviews(selected!.id),
		enabled: selected !== null,
	});
	const approved = (reviewsQuery.data ?? []).filter((item) => item.reviewed).map((item) => item.step_id);
	const reviewMutation = useMutation({
		mutationFn: ({ stepId, reviewed }: { stepId: string; reviewed: boolean }) =>
			updatePathReview(selected!.id, stepId, reviewed),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ['path-reviews', selected?.id] }),
	});

	const steps = useMemo(
		() => buildPath(selected?.target ?? null, findingsQuery.data?.items ?? []),
		[selected?.target, findingsQuery.data?.items],
	);
	const technologies = Array.from(new Set((assetsQuery.data?.items ?? []).flatMap((asset) => asset.technologies ?? [])));
	const sourceTools = Array.from(new Set((findingsQuery.data?.items ?? []).map((finding) => finding.source_tool)));

	if (!active) return <Navigate to="/dashboard" replace />;

	const setStepApproval = (id: string) => {
		reviewMutation.mutate({ stepId: id, reviewed: !approved.includes(id) });
	};

	return (
		<>
			<Header
				eyebrow={t('Adversary simulation', 'Симуляция противника')}
				title={t('Attack Paths', 'Цепочки атак')}
				subtitle={t('Turn observed exposure into a human-reviewed path. Facts are scanner evidence; hypotheses are defensive modeling only.', 'Постройте проверяемую человеком цепочку по данным сканера. Факты отделены от гипотез и защитных рекомендаций.')}
				right={<span className={styles.simulationBadge}><LockKeyhole size={14} /> {t('No execution', 'Без выполнения атак')}</span>}
			/>

			<ScanSelector
				scans={scans}
				selectedId={selected?.id ?? null}
				isLoading={scansQuery.isPending}
				onChange={(scanId) => setSearchParams({ scan: scanId }, { replace: true })}
			/>

			<section className={styles.commandBar} aria-label="Adversary workspace status">
				<div><Route size={18} /><span><strong>{steps.length}</strong> {t('modeled phases', 'смоделированных этапов')}</span></div>
				<div><Cpu size={18} /><span><strong>{sourceTools.length}</strong> {t('evidence engines', 'источников данных')}</span></div>
				<div><GitBranch size={18} /><span><strong>{approved.length}/{steps.length}</strong> {t('human reviewed', 'проверено человеком')}</span></div>
				<div className={styles.aiOff}><Sparkles size={18} /><span><strong>AI strategist</strong> {t('not connected', 'не подключён')}</span></div>
			</section>

			{selected ? (
				<div className={styles.workspace}>
					<section className={styles.pathPanel}>
						<div className={styles.sectionHeading}>
							<div><p>{t('Scenario 01', 'Сценарий 01')}</p><h2>{t('Likely route to material exposure', 'Вероятная цепочка до значимого риска')}</h2></div>
							<span>{selected.target}</span>
						</div>

						<ol className={styles.pathList}>
							{steps.map((step, index) => {
								const reviewed = approved.includes(step.id);
								return (
									<li key={step.id} className={reviewed ? styles.reviewed : ''}>
										<div className={styles.rail}><span>{String(index + 1).padStart(2, '0')}</span></div>
										<article>
											<header>
												<div><p>{step.phase}</p><h3>{step.title}</h3></div>
												<span className={`${styles.severity} ${styles[step.severity]}`}>{step.severity}</span>
											</header>
											<div className={styles.stepGrid}>
												<div><span>{t('Observed evidence', 'Наблюдаемые факты')}</span><p>{step.evidence}</p></div>
												<div><span>{t('Adversary hypothesis', 'Гипотеза противника')}</span><p>{step.hypothesis}</p></div>
												<div><span>{t('Defensive objective', 'Защитная цель')}</span><p>{step.defensiveObjective}</p></div>
											</div>
											<button type="button" onClick={() => setStepApproval(step.id)} className={reviewed ? styles.approved : ''} disabled={reviewMutation.isPending}>
												{reviewed ? <Check size={15} /> : <CircleAlert size={15} />}
												{reviewed ? t('Reviewed by human', 'Проверено человеком') : t('Mark reviewed for simulation', 'Подтвердить проверку этапа')}
											</button>
										</article>
									</li>
								);
							})}
						</ol>
					</section>

					<aside className={styles.intelPanel}>
						<p className={styles.panelKicker}>{t('Evidence matrix', 'Матрица данных')}</p>
						<h2>{t('What the model knows', 'Что известно модели')}</h2>
						<dl>
							<div><dt>Target</dt><dd>{selected.target}</dd></div>
							<div><dt>Live assets</dt><dd>{assetsQuery.data?.items.filter((asset) => asset.is_alive).length ?? 0}</dd></div>
							<div><dt>Findings</dt><dd>{findingsQuery.data?.items.length ?? 0}</dd></div>
						</dl>
						<div className={styles.intelGroup}>
							<h3>Observed technologies</h3>
							<div>{technologies.length ? technologies.map((item) => <span key={item}>{item}</span>) : <em>None reported</em>}</div>
						</div>
						<div className={styles.intelGroup}>
							<h3>Evidence sources</h3>
							<div>{sourceTools.length ? sourceTools.map((item) => <span key={item}>{item}</span>) : <em>No findings</em>}</div>
						</div>
						<div className={styles.guardrail}>
							<Shield size={18} />
							<p><strong>{t('Human control is active.', 'Контроль человека включён.')}</strong> {t('Review decisions are persisted by the backend. No scanner, exploit, or payload is launched from this page.', 'Решения сохраняются на сервере. Эта страница не запускает сканеры, эксплойты или payload.')}</p>
						</div>
					</aside>
				</div>
			) : (
				<div className={styles.empty}><CircleAlert size={22} /><h2>No completed scan available</h2><p>Complete an authorized scan first, then return to model its attack path.</p></div>
			)}
		</>
	);
}

function buildPath(target: string | null, findings: FindingResponse[]): PathStep[] {
	if (!target) return [];
	const sorted = [...findings].sort((a, b) => severityOrder[b.severity] - severityOrder[a.severity]).slice(0, 4);
	const opening: PathStep = {
		id: 'surface', phase: 'Reconnaissance', title: 'Public surface identified', severity: 'context',
		evidence: `The completed scan reached ${target} and created an evidence set.`,
		hypothesis: 'An adversary would begin by mapping reachable services and exposed technology.',
		defensiveObjective: 'Confirm intended exposure, ownership, and the minimum required public services.',
	};
	const findingSteps = sorted.map((finding, index): PathStep => ({
		id: finding.id,
		phase: index === 0 ? 'Initial access hypothesis' : 'Exposure pivot',
		title: finding.name,
		severity: finding.severity,
		evidence: `${finding.source_tool}${finding.template_id ? ` / ${finding.template_id}` : ''} reported ${finding.matched_at ?? target}.`,
		hypothesis: hypothesisFor(finding),
		defensiveObjective: finding.description || 'Validate the exposure, reduce access, and apply the scanner recommendation.',
	}));
	return [opening, ...findingSteps];
}

function hypothesisFor(finding: FindingResponse) {
	const text = `${finding.name} ${finding.description ?? ''}`.toLowerCase();
	if (text.includes('admin')) return 'A reachable administrative surface could become a high-value access boundary if controls are weak.';
	if (text.includes('directory') || text.includes('listing')) return 'Browsable files could disclose implementation details that make later targeting more precise.';
	if (text.includes('header')) return 'Missing browser controls may increase the impact of a separate client-side weakness.';
	if (finding.cve) return `The observed ${finding.cve} reference should be validated against the exact deployed version before prioritization.`;
	return 'This exposure may provide context or leverage when combined with another verified weakness.';
}
