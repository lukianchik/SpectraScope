import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { CheckCircle2, Cloud, MessageSquare, Plug, Settings2 } from 'lucide-react';
import { Header } from '../../Header/Header';
import { getApiErrorMessage } from '../../shared/api/client';
import { listIntegrations, updateIntegration } from '../../shared/api/workspace';
import s from '../_shared/pageStyles.module.scss';
import own from './IntegrationsPage.module.scss';

const ICON: Record<string, typeof Cloud> = {
        comms: MessageSquare,
        ticketing: Plug,
        siem: Cloud,
        cloud: Cloud,
};

export function IntegrationsPage() {
        const queryClient = useQueryClient();
        const [configuring, setConfiguring] = useState<string | null>(null);
        const [webhookUrl, setWebhookUrl] = useState('');
        const integrationsQuery = useQuery({ queryKey: ['integrations'], queryFn: listIntegrations });
        const updateMutation = useMutation({
                mutationFn: ({ id, enabled, config }: { id: string; enabled: boolean; config?: Record<string, string> }) => updateIntegration(id, enabled, config),
                onSuccess: () => queryClient.invalidateQueries({ queryKey: ['integrations'] }),
        });
        const error = integrationsQuery.error ?? updateMutation.error;

        return (
                <>
                        <Header
                                eyebrow="Connections"
                                title="Integrations"
                                subtitle="Persistent integration state. Credentials must be configured before an enabled connector can become healthy."
                        />
                        {error ? <p className={s.error}>{getApiErrorMessage(error)}</p> : null}
                        <div className={own.grid}>
                                {(integrationsQuery.data ?? []).map((integration) => {
                                        const Icon = ICON[integration.kind] ?? Plug;
                                        return (
                                                <article key={integration.id} className={own.card} data-hoverable data-testid={`integration-${integration.name}`}>
                                                        <div className={own.head}>
                                                                <div className={own.icon}><Icon size={18} /></div>
                                                                <div><p className={own.name}>{integration.name}</p><p className={own.kind}>{integration.kind} · {integration.status}</p></div>
                                                                {integration.status === 'healthy' ? <CheckCircle2 size={16} className={own.check} /> : null}
                                                        </div>
                                                        <p className={own.desc}>{integration.description}</p>
                                                        <div className={own.actions}>
                                                                <button
                                                                        type="button"
                                                                        className={`${own.toggle} ${integration.enabled ? own.toggleOn : ''}`}
                                                                        onClick={() => updateMutation.mutate({ id: integration.id, enabled: !integration.enabled })}
                                                                        role="switch"
                                                                        aria-checked={integration.enabled}
                                                                        aria-label={`${integration.name} integration`}
                                                                        data-state={integration.enabled ? 'on' : 'off'}
                                                                        data-testid={`toggle-${integration.name}`}
                                                                        disabled={updateMutation.isPending}
                                                                ><span className={own.toggleDot} /></button>
                                                                <button type="button" className={s.btnGhost} disabled={integration.name !== 'Slack'} onClick={() => setConfiguring(configuring === integration.id ? null : integration.id)}>
                                                                        <Settings2 size={14} /> Configure
                                                                </button>
                                                        </div>
                                                        {configuring === integration.id && integration.name === 'Slack' ? (
                                                                <form className={own.configForm} onSubmit={(event) => {
                                                                        event.preventDefault();
                                                                        updateMutation.mutate({ id: integration.id, enabled: true, config: { webhook_url: webhookUrl } }, { onSuccess: () => { setWebhookUrl(''); setConfiguring(null); } });
                                                                }}>
                                                                        <label><span>Slack webhook URL</span><input type="url" value={webhookUrl} onChange={(event) => setWebhookUrl(event.target.value)} placeholder="https://hooks.slack.com/services/…" required pattern="https://.*" /></label>
                                                                        <p>The URL is encrypted before it is stored and is never returned by the API.</p>
                                                                        <button type="submit" className={s.btnPrimary} disabled={updateMutation.isPending}>Save securely</button>
                                                                </form>
                                                        ) : null}
                                                </article>
                                        );
                                })}
                        </div>
                </>
        );
}
