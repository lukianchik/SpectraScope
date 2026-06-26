import { Activity, Cpu, Database, HeartPulse, Radio, Workflow } from 'lucide-react';
import { Header } from '../../Header/Header';
import s from '../_shared/pageStyles.module.scss';
import own from './MonitoringPage.module.scss';

const HEALTH = [
        { name: 'FastAPI · /health/live', status: 'up', detail: 'Liveness probe responding · 12ms', icon: HeartPulse },
        { name: 'FastAPI · /health/ready', status: 'up', detail: 'Postgres + Redis reachable', icon: Workflow },
        { name: 'PostgreSQL', status: 'up', detail: 'Connections 6 / 100', icon: Database },
        { name: 'Redis broker', status: 'up', detail: 'Latency 0.6ms · 24 keys', icon: Radio },
        { name: 'Celery worker · default', status: 'up', detail: '2 active · 0 queued', icon: Cpu },
        { name: 'Celery worker · scans', status: 'warn', detail: '1 active · 3 queued · backlog growing', icon: Activity },
];

// Sparkline data
const SCAN_HISTORY = [4, 6, 5, 8, 7, 9, 12, 8, 10, 11, 9, 14, 12, 15, 13];
const FINDING_HISTORY = [12, 18, 15, 20, 22, 19, 24, 27, 25, 30, 28, 32, 31, 35, 33];

function Spark({ data, color }: { data: number[]; color: string }) {
        const w = 220;
        const h = 56;
        const max = Math.max(...data);
        const min = Math.min(...data);
        const path = data
                .map((v, i) => {
                        const x = (i / (data.length - 1)) * w;
                        const y = h - ((v - min) / (max - min || 1)) * (h - 6) - 3;
                        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
                })
                .join(' ');
        return (
                <svg viewBox={`0 0 ${w} ${h}`} className={own.spark}>
                        <path d={`${path} L${w},${h} L0,${h} Z`} fill={`${color}22`} />
                        <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" />
                </svg>
        );
}

export function MonitoringPage() {
        return (
                <>
                        <Header
                                eyebrow="Observability"
                                title="Monitoring"
                                subtitle="Health probes, scanner adapter activity and request latency for the SpectraScope stack — all the signals you'd expect from /metrics."
                        />

                        <section className={own.tiles}>
                                <div className={own.tile}>
                                        <p className={own.tileEyebrow}>Scans / 24h</p>
                                        <p className={own.tileValue}>148</p>
                                        <Spark data={SCAN_HISTORY} color="#4f8cff" />
                                </div>
                                <div className={own.tile}>
                                        <p className={own.tileEyebrow}>Findings / 24h</p>
                                        <p className={own.tileValue}>1.2k</p>
                                        <Spark data={FINDING_HISTORY} color="#4ee0c5" />
                                </div>
                                <div className={own.tile}>
                                        <p className={own.tileEyebrow}>p50 latency</p>
                                        <p className={own.tileValue}>184<small>ms</small></p>
                                        <Spark data={[120, 140, 130, 180, 200, 184, 210, 195, 188, 175, 200, 184, 180, 178, 184]} color="#ffb347" />
                                </div>
                                <div className={own.tile}>
                                        <p className={own.tileEyebrow}>Adapter errors</p>
                                        <p className={own.tileValue}>3</p>
                                        <Spark data={[0, 1, 0, 2, 1, 0, 0, 3, 1, 2, 0, 1, 0, 2, 3]} color="#ff4f7a" />
                                </div>
                        </section>

                        <section className={own.healthList} data-testid="health-list">
                                {HEALTH.map((h) => {
                                        const Icon = h.icon;
                                        return (
                                                <article key={h.name} className={own.healthRow} data-tone={h.status}>
                                                        <div className={own.healthIcon}><Icon size={18} /></div>
                                                        <div>
                                                                <p className={own.healthName}>{h.name}</p>
                                                                <p className={own.healthDetail}>{h.detail}</p>
                                                        </div>
                                                        <span className={`${s.statusPill} ${h.status === 'up' ? s.completed : h.status === 'warn' ? s.running : s.failed}`}>
                                                                <span className={s.dot} /> {h.status}
                                                        </span>
                                                </article>
                                        );
                                })}
                        </section>
                </>
        );
}
