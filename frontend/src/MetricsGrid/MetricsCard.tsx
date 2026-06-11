import type { CSSProperties } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Boxes, CircleAlert, Gauge, Server, ShieldAlert, TriangleAlert } from 'lucide-react';
import type { Metric } from '../types/dashboard';
import styles from './MetricsGrid.module.scss';

interface MetricsCardProps {
	metric: Metric;
}

const metricIcon: Record<Metric['label'], LucideIcon> = {
	'Total Assets': Boxes,
	'Live Hosts': Server,
	Findings: TriangleAlert,
	'Critical Findings': ShieldAlert,
	'Risk Score': Gauge,
};

export function MetricsCard({ metric }: MetricsCardProps) {
	const Icon = metricIcon[metric.label] ?? CircleAlert;
	const hasGauge = typeof metric.progress === 'number';

	return (
		<article
			className={`${styles.metricCard} ${styles[metric.tone]} ${hasGauge ? styles.hasGauge : ''}`}
		>
			<div className={styles.metricIcon}>
				<Icon size={20} aria-hidden="true" />
			</div>
			<div className={styles.metricBody}>
				<p className={styles.metricLabel}>{metric.label}</p>
				<div className={styles.metricValueRow}>
					<strong className={styles.metricValue}>{metric.value}</strong>
					<span className={styles.metricDelta}>{metric.delta}</span>
				</div>
				<p className={styles.metricCaption}>{metric.caption}</p>
			</div>
			{hasGauge ? (
				<div
					className={styles.gauge}
					style={{ '--progress': `${metric.progress}%` } as CSSProperties}
					aria-hidden="true"
				>
					<div className={styles.gaugeInner}>{metric.progress}</div>
				</div>
			) : null}
		</article>
	);
}
