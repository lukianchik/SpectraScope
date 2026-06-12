import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import type { ScanStartInput } from '../shared/api/scans';
import { LAB_TARGET_PRESETS } from '../types/dashboard';
import styles from './StartScan.module.scss';

interface StartScanProps {
	activeQueueCount: number;
	errorMessage: string | null;
	isSubmitting: boolean;
	onSubmit: (payload: ScanStartInput) => Promise<void>;
}

interface StartScanFormValues {
	target: string;
	scanProfile: string;
	notificationChannel: string;
	confirmAuthorized: boolean;
}

const startScanSchema = z.object({
	target: z.string().trim().min(3, 'Enter a target or choose a lab preset.'),
	scanProfile: z.string().min(1, 'Choose a scan profile.'),
	notificationChannel: z.string().min(1),
	confirmAuthorized: z.boolean().refine((value) => value, {
		message: 'Confirm that you are authorized to assess this target.',
	}),
});

export function StartScan({ activeQueueCount, errorMessage, isSubmitting, onSubmit }: StartScanProps) {
	const {
		clearErrors,
		formState: { errors },
		handleSubmit,
		register,
		setError,
		setValue,
		watch,
	} = useForm<StartScanFormValues>({
		defaultValues: {
			target: LAB_TARGET_PRESETS[0],
			scanProfile: 'lab',
			notificationChannel: 'dashboard',
			confirmAuthorized: true,
		},
	});

	const targetValue = watch('target');
	const confirmAuthorized = watch('confirmAuthorized');
	const canSubmit = useMemo(
		() => targetValue.trim().length >= 3 && confirmAuthorized && !isSubmitting,
		[targetValue, confirmAuthorized, isSubmitting],
	);

	const submitForm = handleSubmit(async (values) => {
		clearErrors();
		const parsed = startScanSchema.safeParse(values);

		if (!parsed.success) {
			const fieldErrors = parsed.error.flatten().fieldErrors;

			for (const [field, messages] of Object.entries(fieldErrors)) {
				if (messages?.[0]) {
					setError(field as keyof StartScanFormValues, { message: messages[0] });
				}
			}

			return;
		}

		await onSubmit({
			target: parsed.data.target,
			scan_profile: parsed.data.scanProfile,
			confirm_authorized: parsed.data.confirmAuthorized,
		});
	});

	return (
		<section className={styles.panel}>
			<div className={styles.heading}>
				<div>
					<p className={styles.eyebrow}>Scan orchestration</p>
					<h2>Start a new external exposure scan</h2>
				</div>
				<span className={styles.badge}>Live queue: {activeQueueCount.toString().padStart(2, '0')}</span>
			</div>

			<div className={styles.presetRow}>
				{LAB_TARGET_PRESETS.map((preset) => (
					<button
						key={preset}
						type="button"
						className={styles.presetButton}
						onClick={() => {
							setValue('target', preset, { shouldDirty: true, shouldTouch: true });
							clearErrors('target');
						}}
					>
						{preset}
					</button>
				))}
			</div>

			<form className={styles.form} onSubmit={submitForm}>
				<label className={styles.field}>
					<span>Target</span>
					<input
						type="text"
						placeholder="admin.lab.local:8088"
						{...register('target')}
						aria-invalid={errors.target ? 'true' : 'false'}
					/>
					{errors.target ? <span className={styles.fieldError}>{errors.target.message}</span> : null}
				</label>

				<label className={styles.field}>
					<span>Scan profile</span>
					<select {...register('scanProfile')}>
						<option value="lab">Lab validation</option>
						<option value="safe">Safe external discovery</option>
						<option value="discovery">Discovery only</option>
					</select>
					{errors.scanProfile ? (
						<span className={styles.fieldError}>{errors.scanProfile.message}</span>
					) : null}
				</label>

				<label className={styles.field}>
					<span>Notification channel</span>
					<select {...register('notificationChannel')}>
						<option value="dashboard">Dashboard only</option>
						<option value="slack">Slack and dashboard</option>
						<option value="email">Email summary</option>
					</select>
				</label>

				<label className={styles.checkbox}>
					<input type="checkbox" {...register('confirmAuthorized')} />
					<span>I confirm this target is authorized for testing.</span>
				</label>
				{errors.confirmAuthorized ? (
					<p className={styles.formError}>{errors.confirmAuthorized.message}</p>
				) : null}
				{errorMessage ? <p className={styles.formError}>{errorMessage}</p> : null}

				<div className={styles.actions}>
					<button
						type="submit"
						className={styles.primaryButton}
						disabled={!canSubmit}
					>
						{isSubmitting ? 'Starting scan...' : 'Start scan'}
					</button>
					<button type="button" className={styles.secondaryButton} disabled>
						Polling enabled
					</button>
				</div>
			</form>
		</section>
	);
}
