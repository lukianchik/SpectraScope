import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Gauge, Save, ShieldCheck } from 'lucide-react';
import { Header } from '../../Header/Header';
import { getApiErrorMessage } from '../../shared/api/client';
import {
        getWorkspaceSettings,
        updateWorkspaceSettings,
        type WorkspaceSettingsInput,
} from '../../shared/api/workspace';
import s from '../_shared/pageStyles.module.scss';
import own from './SettingsPage.module.scss';

const emptyForm: WorkspaceSettingsInput = {
        allowed_target_domains: [],
        allowed_lab_targets: [],
        default_notification_channel: 'dashboard',
        alert_threshold: 'high',
};

export function SettingsPage() {
        const queryClient = useQueryClient();
        const settingsQuery = useQuery({ queryKey: ['workspace-settings'], queryFn: getWorkspaceSettings });
        const [draft, setDraft] = useState<WorkspaceSettingsInput | null>(null);
        const [savedAt, setSavedAt] = useState<string | null>(null);
        const serverForm: WorkspaceSettingsInput = settingsQuery.data ? {
                allowed_target_domains: settingsQuery.data.allowed_target_domains,
                allowed_lab_targets: settingsQuery.data.allowed_lab_targets,
                default_notification_channel: settingsQuery.data.default_notification_channel,
                alert_threshold: settingsQuery.data.alert_threshold,
        } : emptyForm;
        const form = draft ?? serverForm;
        const patchForm = (patch: Partial<WorkspaceSettingsInput>) =>
                setDraft((current) => ({ ...(current ?? serverForm), ...patch }));

        const saveMutation = useMutation({
                mutationFn: updateWorkspaceSettings,
                onSuccess: (settings) => {
                        queryClient.setQueryData(['workspace-settings'], settings);
                        setDraft(null);
                        setSavedAt(new Date(settings.updated_at ?? Date.now()).toLocaleTimeString());
                },
        });

        const onSave = (event: React.FormEvent) => {
                event.preventDefault();
                saveMutation.mutate(form);
        };

        const runtime = settingsQuery.data?.runtime;
        const error = settingsQuery.error ?? saveMutation.error;

        return (
                <>
                        <Header
                                eyebrow="Workspace"
                                title="Settings"
                                subtitle="Persistent authorization scope and notification defaults. Scanner execution flags remain deployment-controlled."
                        />

                        {error ? <p className={s.error}>{getApiErrorMessage(error)}</p> : null}

                        <form className={own.grid} onSubmit={onSave} data-testid="settings-form">
                                <section className={own.card}>
                                        <h3 className={own.h3}><ShieldCheck size={16} /> Target authorization</h3>
                                        <p className={own.help}>
                                                In real-scanner mode these values may only narrow the deployment allowlist; they can never expand it.
                                        </p>
                                        <label className={own.label}>
                                                <span>Allowed target domains</span>
                                                <textarea
                                                        rows={4}
                                                        value={form.allowed_target_domains.join('\n')}
                                                        onChange={(event) => patchForm({
                                                                allowed_target_domains: lines(event.target.value),
                                                        })}
                                                        className={own.textarea}
                                                />
                                        </label>
                                        <label className={own.label}>
                                                <span>Allowed lab targets</span>
                                                <textarea
                                                        rows={3}
                                                        value={form.allowed_lab_targets.join('\n')}
                                                        onChange={(event) => patchForm({
                                                                allowed_lab_targets: lines(event.target.value),
                                                        })}
                                                        className={own.textarea}
                                                />
                                        </label>
                                </section>

                                <section className={own.card}>
                                        <h3 className={own.h3}><Gauge size={16} /> Deployment safety</h3>
                                        <p className={own.help}>Read-only runtime flags loaded by the API and scanner worker.</p>
                                        <ul className={own.toggleList}>
                                                <RuntimeValue label="Environment" value={runtime?.app_env ?? 'loading'} />
                                                <RuntimeValue label="Real scanners" value={runtime?.enable_real_scanners ? 'enabled' : 'disabled'} />
                                                <RuntimeValue label="Local-real mode" value={runtime?.local_real_scanners ? 'enabled' : 'disabled'} />
                                                <RuntimeValue label="LAB_MODE" value={runtime?.lab_mode ? 'enabled' : 'disabled'} />
                                                <RuntimeValue label="nmap" value={runtime?.enable_nmap ? 'enabled' : 'disabled'} />
                                                <RuntimeValue label="Benchmark DNS proxy" value={runtime?.allow_benchmark_dns_proxy ? 'enabled' : 'disabled'} />
                                                <RuntimeValue label="Limits" value={`${runtime?.scanner_timeout_seconds ?? '—'}s / ${runtime?.scanner_max_results ?? '—'} results`} />
                                        </ul>
                                </section>

                                <section className={own.card}>
                                        <h3 className={own.h3}><ShieldCheck size={16} /> Notifications</h3>
                                        <label className={own.label}>
                                                <span>Default channel</span>
                                                <select
                                                        className={own.select}
                                                        value={form.default_notification_channel}
                                                        onChange={(event) => patchForm({
                                                                default_notification_channel: event.target.value as WorkspaceSettingsInput['default_notification_channel'],
                                                        })}
                                                >
                                                        <option value="dashboard">Dashboard only</option>
                                                        <option value="slack">Slack</option>
                                                        <option value="email">Email</option>
                                                </select>
                                        </label>
                                        <label className={own.label}>
                                                <span>Alert threshold</span>
                                                <select
                                                        className={own.select}
                                                        value={form.alert_threshold}
                                                        onChange={(event) => patchForm({
                                                                alert_threshold: event.target.value as WorkspaceSettingsInput['alert_threshold'],
                                                        })}
                                                >
                                                        <option value="info">Info and above</option>
                                                        <option value="low">Low and above</option>
                                                        <option value="medium">Medium and above</option>
                                                        <option value="high">High and above</option>
                                                        <option value="critical">Critical only</option>
                                                </select>
                                        </label>
                                </section>

                                <div className={own.saveBar}>
                                        <span className={own.savedAt}>
                                                {saveMutation.isPending ? 'Saving…' : savedAt ? `Saved at ${savedAt}` : 'Settings are stored by the backend.'}
                                        </span>
                                        <button type="submit" className={s.btnPrimary} data-testid="settings-save" disabled={saveMutation.isPending || settingsQuery.isPending}>
                                                <Save size={14} /> Save settings
                                        </button>
                                </div>
                        </form>
                </>
        );
}

function RuntimeValue({ label, value }: { label: string; value: string }) {
        return <li className={own.toggleItem}><p className={own.toggleLabel}>{label}</p><p className={own.toggleHint}>{value}</p></li>;
}

function lines(value: string) {
        return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
}
