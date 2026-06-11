import { Header } from '../../Header/Header';
import { MetricsGrid } from '../../MetricsGrid/MetricsGrid';
import { StartScan } from '../../StartScan/StartScan';
import { metrics, scanSteps } from '../../types/dashboard';
import { Sidebar } from '../../widgets/Sidebar/Sidebar';
import styles from './Dashboard.module.scss';

export function Dashboard() {
	return (
		<div className={styles.shell}>
			<Sidebar />

			<main className={styles.dashboard}>
				<Header />

				<section className={styles.heroGrid}>
					<StartScan />

					<article className={styles.statusPanel}>
						<div className={styles.statusHeader}>
							<div>
								<p className={styles.sectionEyebrow}>Execution status</p>
								<h2>Scan completed successfully</h2>
								<p className={styles.statusMeta}>
									Finished 2 minutes ago for example.com
								</p>
							</div>
							<span className={styles.statusBadge}>Completed</span>
						</div>

						<div className={styles.steps}>
							{scanSteps.map((step, index) => (
								<div key={step.title} className={styles.stepItem}>
									<div className={styles.stepTrack}>
										<span className={styles.stepDot}>{index + 1}</span>
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
