import { useState } from 'react';
import { CheckCircle2, Cloud, MessageSquare, Plug, Settings2 } from 'lucide-react';
import { Header } from '../../Header/Header';
import { DEMO_INTEGRATIONS } from '../../shared/mock/demoData';
import s from '../_shared/pageStyles.module.scss';
import own from './IntegrationsPage.module.scss';

const ICON: Record<string, typeof Cloud> = {
        comms: MessageSquare,
        ticketing: Plug,
        siem: Cloud,
        cloud: Cloud,
};

export function IntegrationsPage() {
        const [state, setState] = useState(
                Object.fromEntries(DEMO_INTEGRATIONS.map((i) => [i.name, i.enabled])),
        );

        const toggle = (name: string) => setState((p) => ({ ...p, [name]: !p[name] }));

        return (
                <>
                        <Header
                                eyebrow="Connections"
                                title="Integrations"
                                subtitle="Route findings, scans and audit logs into the tools your team already uses. Toggle to simulate connecting in the demo."
                        />

                        <div className={own.grid}>
                                {DEMO_INTEGRATIONS.map((i) => {
                                        const Icon = ICON[i.kind] ?? Plug;
                                        const enabled = state[i.name];
                                        return (
                                                <article key={i.name} className={own.card} data-hoverable data-testid={`integration-${i.name}`}>
                                                        <div className={own.head}>
                                                                <div className={own.icon}><Icon size={18} /></div>
                                                                <div>
                                                                        <p className={own.name}>{i.name}</p>
                                                                        <p className={own.kind}>{i.kind}</p>
                                                                </div>
                                                                {enabled ? <CheckCircle2 size={16} className={own.check} /> : null}
                                                        </div>
                                                        <p className={own.desc}>{i.desc}</p>
                                                        <div className={own.actions}>
                                                                <button
                                                                        type="button"
                                                                        className={`${own.toggle} ${enabled ? own.toggleOn : ''}`}
                                                                        onClick={() => toggle(i.name)}
                                                                        aria-pressed={enabled}
                                                                        data-testid={`toggle-${i.name}`}
                                                                >
                                                                        <span className={own.toggleDot} />
                                                                </button>
                                                                <button className={s.btnGhost}>
                                                                        <Settings2 size={14} /> Configure
                                                                </button>
                                                        </div>
                                                </article>
                                        );
                                })}
                        </div>
                </>
        );
}
