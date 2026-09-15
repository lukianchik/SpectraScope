import { useQuery } from '@tanstack/react-query';
import { Activity, Database, HeartPulse, Radio, Workflow } from 'lucide-react';
import { Header } from '../../Header/Header';
import { getApiErrorMessage } from '../../shared/api/client';
import { getMonitoringSummary } from '../../shared/api/workspace';
import s from '../_shared/pageStyles.module.scss';
import own from './MonitoringPage.module.scss';

const ICONS = [HeartPulse, Database, Radio, Workflow];

function Spark({ data, color }: { data: number[]; color: string }) {
        const safeData = data.length > 1 ? data : [0, 0];
        const w = 220;
        const h = 56;
        const max = Math.max(...safeData);
        const min = Math.min(...safeData);
        const path = safeData.map((value, index) => {
                const x = (index / (safeData.length - 1)) * w;
                const y = h - ((value - min) / (max - min || 1)) * (h - 6) - 3;
                return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
        }).join(' ');
        return <svg viewBox={`0 0 ${w} ${h}`} className={own.spark}><path d={`${path} L${w},${h} L0,${h} Z`} fill={`${color}22`} /><path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" /></svg>;
}

export function MonitoringPage() {
        const summaryQuery = useQuery({
                queryKey: ['monitoring-summary'],
                queryFn: getMonitoringSummary,
                refetchInterval: 15_000,
        });
        const summary = summaryQuery.data;

        return (
                <>
                        <Header
                                eyebrow="Observability"
                                title="Monitoring"
                                subtitle="Live API, database, broker, queue and 24-hour product metrics. Refreshed every 15 seconds."
                        />
                        {summaryQuery.error ? <p className={s.error}>{getApiErrorMessage(summaryQuery.error)}</p> : null}

                        <section className={own.tiles}>
                                <Metric title="Scans / 24h" value={summary?.scans_24h ?? 0} data={summary?.scan_history ?? []} color="#4f8cff" />
                                <Metric title="Findings / 24h" value={summary?.findings_24h ?? 0} data={summary?.finding_history ?? []} color="#4ee0c5" />
                                <Metric title="Failed scans / 24h" value={summary?.failed_scans_24h ?? 0} data={[0, summary?.failed_scans_24h ?? 0]} color="#ff4f7a" />
                                <Metric title="Queued scans" value={summary?.queued_scans ?? 0} data={[0, summary?.queued_scans ?? 0]} color="#ffb347" />
                        </section>

                        <section className={own.healthList} data-testid="health-list">
                                {(summary?.services ?? []).map((service, index) => {
                                        const Icon = ICONS[index % ICONS.length] ?? Activity;
                                        return (
                                                <article key={service.name} className={own.healthRow} data-tone={service.status}>
                                                        <div className={own.healthIcon}><Icon size={18} /></div>
                                                        <div><p className={own.healthName}>{service.name}</p><p className={own.healthDetail}>{service.detail}</p></div>
                                                        <span className={`${s.statusPill} ${service.status === 'up' ? s.completed : service.status === 'warn' ? s.running : s.failed}`}>
                                                                <span className={s.dot} /> {service.status}
                                                        </span>
                                                </article>
                                        );
                                })}
                        </section>
                </>
        );
}

function Metric({ title, value, data, color }: { title: string; value: number; data: number[]; color: string }) {
        return <div className={own.tile}><p className={own.tileEyebrow}>{title}</p><p className={own.tileValue}>{value.toLocaleString()}</p><Spark data={data} color={color} /></div>;
}
