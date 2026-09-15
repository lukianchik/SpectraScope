import { Link } from 'react-router-dom';
import {
        ArrowRight,
        Brain,
        Code2,
        Crosshair,
        Eye,
        FileSearch,
        Globe2,
        ShieldAlert,
        ShieldCheck,
        TerminalSquare,
} from 'lucide-react';
import { Background } from '../../widgets/Background/Background';
import styles from './Landing.module.scss';

const FEATURES = [
        {
                icon: Globe2,
                title: 'Surface Discovery',
                text: 'Map every public-facing host, subdomain and shadow service of your perimeter through safe DNS, TLS and HTTP signals.',
        },
        {
                icon: FileSearch,
                title: 'Curated Findings',
                text: 'Adapter outputs from subfinder, httpx and nuclei normalised into deduplicated, severity-scored findings with CVE & CVSS context.',
        },
        {
                icon: Crosshair,
                title: 'Authorized-Targets Only',
                text: 'Domain allowlists, lab-target gating and explicit authorization checks built into every scan — no unauthorized recon.',
        },
        {
                icon: Brain,
                title: 'Risk Reports You Can Send',
                text: 'Auto-generated executive summaries, top risks and remediation playbooks the moment a scan completes.',
        },
        {
                icon: TerminalSquare,
                title: 'Adapter Architecture',
                text: 'Pluggable Python scanner adapters with safe subprocess execution — no shell=true, strict timeouts, structured outputs.',
        },
        {
                icon: Eye,
                title: 'Audit-Ready by Default',
                text: 'Every scan launch writes a durable authorization record. Liveness, readiness and Prometheus metrics are included.',
        },
];

const PIPELINE = [
        { key: '01', name: 'Resolve', desc: 'Subfinder enumerates passive subdomains for the authorized target.' },
        { key: '02', name: 'Probe', desc: 'Httpx checks liveness, TLS posture and lightweight tech fingerprints.' },
        { key: '03', name: 'Detect', desc: 'Nuclei templates flag known weaknesses without active exploitation.' },
        { key: '04', name: 'Report', desc: 'Normalized findings roll up into a risk report with prioritized fixes.' },
];

const BLIPS = [
        { name: 'api.acme.io', x: 64, y: 22, delay: '0s' },
        { name: 'admin.lab.local', x: 72, y: 68, delay: '0.4s' },
        { name: 'edge.example', x: 28, y: 76, delay: '0.8s' },
        { name: 'mail.acme.io', x: 30, y: 32, delay: '1.2s' },
        { name: 'cdn.acme.io', x: 50, y: 50, delay: '1.6s' },
];

export function Landing() {
        return (
                <div className={styles.landing} data-testid="landing-page">
                        <Background />
			<a className={styles.skipLink} href="#main-content">Skip to content</a>

                        <nav className={styles.nav} aria-label="Landing navigation">
                                <Link to="/" className={styles.brand}>
                                        <div className={styles.brandMark} aria-hidden="true" />
                                        <span className={styles.brandName}>SpectraScope</span>
                                </Link>
                                <div className={styles.navLinks}>
                                        <a href="#features">Features</a>
                                        <a href="#pipeline">Pipeline</a>
                                        <a href="#safety">Safety</a>
                                        <Link to="/scans">Scans</Link>
                                        <Link to="/findings">Findings</Link>
                                </div>
                                <Link to="/dashboard" className={styles.navCta} data-testid="nav-launch">
                                        Launch Console <ArrowRight size={14} />
                                </Link>
                        </nav>

			<main id="main-content">
                        <section className={styles.hero}>
                                <div className={styles.heroLeft}>
                                        <span className={styles.tag}>
                                                <span className={styles.dot} /> v1.0 RC · safe-by-default
                                        </span>
                                        <h1 className={styles.h1}>
                                                See your <span className={styles.accent}>exposure</span> before<br />
                                                <span className={styles.strike}>attackers do.</span>
                                        </h1>
                                        <p className={styles.lead}>
                                                SpectraScope is an applied cyber-intelligence platform for authorized external attack surface analysis. Submit a domain you own — the pipeline maps assets, finds weak spots and turns them into a risk report. No exploitation. No surprises.
                                        </p>
                                        <div className={styles.ctaRow}>
                                                <Link to="/dashboard" className={styles.ctaPrimary} data-testid="hero-launch">
                                                        Launch the Console <ArrowRight size={16} />
                                                </Link>
                                                <a href="#pipeline" className={styles.ctaSecondary}>
                                                        See the pipeline
                                                </a>
                                        </div>
                                        <div className={styles.stats}>
                                                <div className={styles.stat}>
                                                        <strong>24</strong>
                                                        <span>assets / scan</span>
                                                </div>
                                                <div className={styles.stat}>
                                                        <strong>15</strong>
                                                        <span>findings / preview</span>
                                                </div>
                                                <div className={styles.stat}>
                                                        <strong>4</strong>
                                                        <span>scanner adapters</span>
                                                </div>
                                        </div>
                                </div>

                                <div className={styles.radar} aria-hidden="true">
                                        <div className={styles.radarFrame} />
                                        <div className={`${styles.radarRing} ${styles.r1}`} />
                                        <div className={`${styles.radarRing} ${styles.r2}`} />
                                        <div className={`${styles.radarRing} ${styles.r3}`} />
                                        <div className={`${styles.radarRing} ${styles.r4}`} />
                                        <div className={styles.crosshair} />
                                        <div className={styles.radarSweep} />
                                        {BLIPS.map((b) => (
                                                <span
                                                        key={b.name}
                                                        className={styles.blip}
                                                        style={{ left: `${b.x}%`, top: `${b.y}%`, animationDelay: b.delay }}
                                                >
                                                        <span className={styles.blipLabel}>{b.name}</span>
                                                </span>
                                        ))}
                                </div>
                        </section>

                        <section className={styles.section} id="features">
                                <div className={styles.sectionHeader}>
                                        <span className={styles.sectionEyebrow}>What you get</span>
                                        <h2 className={styles.h2}>
                                                Reconnaissance that ships <em>findings</em>, not noise.
                                        </h2>
                                        <p className={styles.lead2}>
                                                Every adapter in SpectraScope is hardened against accidental aggression — and tuned so the things you do see actually matter.
                                        </p>
                                </div>

                                <div className={styles.featureGrid}>
                                        {FEATURES.map((f) => {
                                                const Icon = f.icon;
                                                return (
                                                        <article key={f.title} className={styles.featureCard} data-hoverable>
                                                                <div className={styles.featureIcon}>
                                                                        <Icon size={22} />
                                                                </div>
                                                                <h3 className={styles.featureTitle}>{f.title}</h3>
                                                                <p className={styles.featureText}>{f.text}</p>
                                                        </article>
                                                );
                                        })}
                                </div>
                        </section>

                        <section className={styles.section} id="pipeline">
                                <div className={styles.sectionHeader}>
                                        <span className={styles.sectionEyebrow}>How a scan flows</span>
                                        <h2 className={styles.h2}>
                                                Four <em>safe</em> hops from domain to report.
                                        </h2>
                                </div>

                                <div className={styles.pipeline}>
                                        {PIPELINE.map((p) => (
                                                <div key={p.key} className={styles.pipeStep}>
                                                        <p className={styles.pipeKey}>{p.key}</p>
                                                        <p className={styles.pipeName}>{p.name}</p>
                                                        <p className={styles.pipeDesc}>{p.desc}</p>
                                                </div>
                                        ))}
                                </div>
                        </section>

                        <section className={styles.section} id="safety">
                                <div className={styles.safetyStripe}>
                                        <div className={styles.safetyIcon}>
                                                <ShieldAlert size={26} />
                                        </div>
                                        <div className={styles.safetyText}>
                                                <strong>Authorized targets only.</strong>
                                                <p>
                                                        SpectraScope rejects direct-IP targets, gates internal lab subnets behind an explicit allowlist, and refuses to scan any host without a confirmed authorization flag. This is not a pentest framework. It is intentional, auditable reconnaissance.
                                                </p>
                                        </div>
                                </div>
                        </section>

                        <section>
                                <div className={styles.cta}>
                                        <h2>
                                                Ready to see your perimeter through a defender&apos;s lens?
                                        </h2>
                                        <p>
                                                Spin up the console, pick a lab preset or your own authorized domain, and watch the pipeline turn discovery into action.
                                        </p>
                                        <Link to="/dashboard" className={styles.ctaPrimary} data-testid="cta-launch">
                                                <ShieldCheck size={16} /> Launch the Console <ArrowRight size={16} />
                                        </Link>
                                </div>
                        </section>
			</main>

                        <footer className={styles.footer}>
                                <span>SPECTRASCOPE · 1.0.0-rc.1 · SOURCE AVAILABLE</span>
                                <span>FastAPI · Celery · React · Vite · TypeScript</span>
                                <a href="https://github.com/lukianchik/SpectraScope" target="_blank" rel="noreferrer" aria-label="SpectraScope source code on GitHub">
					<Code2 size={14} /> Source
				</a>
                        </footer>
                </div>
        );
}
