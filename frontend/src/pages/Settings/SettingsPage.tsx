import { useState } from 'react';
import { KeyRound, Save, ShieldCheck } from 'lucide-react';
import { Header } from '../../Header/Header';
import s from '../_shared/pageStyles.module.scss';
import own from './SettingsPage.module.scss';

export function SettingsPage() {
        const [savedAt, setSavedAt] = useState<string | null>(null);

        const onSave = (e: React.FormEvent) => {
                e.preventDefault();
                setSavedAt(new Date().toLocaleTimeString());
        };

        return (
                <>
                        <Header
                                eyebrow="Workspace"
                                title="Settings"
                                subtitle="Authorization scope, scanner safety toggles and API keys for the SpectraScope environment."
                        />

                        <form className={own.grid} onSubmit={onSave} data-testid="settings-form">
                                <section className={own.card}>
                                        <h3 className={own.h3}>
                                                <ShieldCheck size={16} /> Target authorization
                                        </h3>
                                        <p className={own.help}>
                                                Only domains in this list will be accepted by safe scans. Subdomains of allowlisted entries are accepted automatically.
                                        </p>
                                        <label className={own.label}>
                                                <span>Allowed target domains</span>
                                                <textarea
                                                        rows={4}
                                                        defaultValue={'aurora.acme.io\nshop.example.com\nedge.example.org'}
                                                        className={own.textarea}
                                                />
                                        </label>
                                        <label className={own.label}>
                                                <span>Allowed lab targets (LAB_MODE)</span>
                                                <textarea
                                                        rows={3}
                                                        defaultValue={'admin.lab.local:8088\nlegacy.lab.local:8088\nfiles.lab.local:8088'}
                                                        className={own.textarea}
                                                />
                                        </label>
                                </section>

                                <section className={own.card}>
                                        <h3 className={own.h3}><ShieldCheck size={16} /> Scanner safety</h3>
                                        <ul className={own.toggleList}>
                                                <Toggle
                                                        label="Enable real scanners"
                                                        hint="When OFF, adapters return mock results. Turn on for production sanctioned scans."
                                                />
                                                <Toggle
                                                        label="Enable nmap adapter"
                                                        hint="Disabled by default. Limited safe flags only — no aggressive scripts."
                                                />
                                                <Toggle
                                                        label="Reject direct-IP targets"
                                                        hint="Refuses naked IPs unless a target is explicitly an authorized lab host:port."
                                                        defaultOn
                                                />
                                                <Toggle
                                                        label="Require authorization confirmation"
                                                        hint="Every scan must include the explicit authorization flag."
                                                        defaultOn
                                                />
                                        </ul>
                                </section>

                                <section className={own.card}>
                                        <h3 className={own.h3}><KeyRound size={16} /> Notifications</h3>
                                        <p className={own.help}>Choose how SpectraScope contacts your team for high-severity events.</p>
                                        <label className={own.label}>
                                                <span>Default channel</span>
                                                <select className={own.select} defaultValue="dashboard">
                                                        <option value="dashboard">Dashboard only</option>
                                                        <option value="slack">Slack #security-alerts</option>
                                                        <option value="email">Email digest</option>
                                                </select>
                                        </label>
                                        <label className={own.label}>
                                                <span>Alert threshold</span>
                                                <select className={own.select} defaultValue="high">
                                                        <option value="info">Info and above</option>
                                                        <option value="medium">Medium and above</option>
                                                        <option value="high">High and above</option>
                                                        <option value="critical">Critical only</option>
                                                </select>
                                        </label>
                                </section>

                                <section className={own.card}>
                                        <h3 className={own.h3}><KeyRound size={16} /> API access</h3>
                                        <p className={own.help}>API keys are scoped per workspace and rotated automatically every 90 days.</p>
                                        <label className={own.label}>
                                                <span>Workspace key</span>
                                                <div className={own.keyRow}>
                                                        <input
                                                                className={own.input}
                                                                readOnly
                                                                defaultValue="sptr_live_5f3a9c7e8b21b4a0c0d23e0c8d1b4f0b"
                                                                data-testid="api-key-input"
                                                        />
                                                        <button type="button" className={s.btnGhost}>Copy</button>
                                                        <button type="button" className={s.btnGhost}>Rotate</button>
                                                </div>
                                        </label>
                                </section>

                                <div className={own.saveBar}>
                                        <span className={own.savedAt}>
                                                {savedAt ? `Saved at ${savedAt}` : 'Changes are local to this preview.'}
                                        </span>
                                        <button type="submit" className={s.btnPrimary} data-testid="settings-save">
                                                <Save size={14} /> Save settings
                                        </button>
                                </div>
                        </form>
                </>
        );
}

function Toggle({ label, hint, defaultOn = false }: { label: string; hint: string; defaultOn?: boolean }) {
        const [on, setOn] = useState(defaultOn);
        return (
                <li className={own.toggleItem}>
                        <div>
                                <p className={own.toggleLabel}>{label}</p>
                                <p className={own.toggleHint}>{hint}</p>
                        </div>
                        <button
                                type="button"
                                className={`${own.toggle} ${on ? own.on : ''}`}
                                onClick={() => setOn((v) => !v)}
                                aria-pressed={on}
                        >
                                <span className={own.toggleDot} />
                        </button>
                </li>
        );
}
