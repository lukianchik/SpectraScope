import type { Metric } from '../types/dashboard';
import { MetricsCard } from './MetricsCard';
import styles from './MetricsGrid.module.scss';

interface MetricsGridProps {
	metrics: Metric[];
}

export function MetricsGrid({ metrics }: MetricsGridProps) {
	return (
		<section className={styles.metricsGrid} aria-label="Key security metrics">
			{metrics.map((metric) => (
				<MetricsCard key={metric.label} metric={metric} />
			))}
		</section>
	);
}
