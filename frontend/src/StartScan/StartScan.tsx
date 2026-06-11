import styles from './StartScan.module.scss';

export function StartScan() {
	return (
		<section className={styles.panel}>
			<div className={styles.heading}>
				<div>
					<p className={styles.eyebrow}>Scan orchestration</p>
					<h2>Start a new external exposure scan</h2>
				</div>
				<span className={styles.badge}>Live queue: 04</span>
			</div>

			<form className={styles.form}>
				<label className={styles.field}>
					<span>Primary domain</span>
					<input type="text" defaultValue="example.com" />
				</label>

				<label className={styles.field}>
					<span>Scan profile</span>
					<select defaultValue="full">
						<option value="full">Full attack surface</option>
						<option value="quick">Quick validation</option>
						<option value="discovery">Discovery only</option>
					</select>
				</label>

				<label className={styles.field}>
					<span>Notification channel</span>
					<select defaultValue="slack">
						<option value="slack">Slack and dashboard</option>
						<option value="email">Email summary</option>
						<option value="none">Dashboard only</option>
					</select>
				</label>

				<label className={styles.checkbox}>
					<input type="checkbox" defaultChecked />
					<span>I confirm this target is authorized for testing.</span>
				</label>

				<div className={styles.actions}>
					<button type="button" className={styles.primaryButton}>
						Start scan
					</button>
					<button type="button" className={styles.secondaryButton}>
						Schedule weekly
					</button>
				</div>
			</form>
		</section>
	);
}
