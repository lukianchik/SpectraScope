import { useMemo } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import type { ScanProfile, ScanStartInput } from '../shared/api/scans';
import { LAB_TARGET_PRESETS } from '../types/dashboard';
import { useLanguage } from '../shared/i18n/useLanguage';
import { ScanProfileDropdown } from './ScanProfileDropdown';
import styles from './StartScan.module.scss';

interface StartScanProps {
	activeQueueCount: number;
	errorMessage: string | null;
	isSubmitting: boolean;
	onSubmit: (payload: ScanStartInput) => Promise<void>;
}

interface StartScanFormValues {
	target: string;
	scanProfile: ScanProfile;
	confirmAuthorized: boolean;
}

const scanProfileSchema = z.enum(['discovery', 'safe', 'lab', 'local-real']);

export function StartScan({ activeQueueCount, errorMessage, isSubmitting, onSubmit }: StartScanProps) {
	const { language, t } = useLanguage();
	const startScanSchema = useMemo(() => z.object({
		target: z.string().trim().min(3, t('Enter a target or choose a lab preset.', 'Введите цель или выберите лабораторный пресет.')),
		scanProfile: scanProfileSchema,
		confirmAuthorized: z.boolean().refine((value) => value, { message: t('Confirm that you are authorized to assess this target.', 'Подтвердите, что у вас есть разрешение на проверку этой цели.') }),
	}), [t]);
	const {
		clearErrors,
		control,
		formState: { errors },
		handleSubmit,
		register,
		setError,
		setValue,
	} = useForm<StartScanFormValues>({
		defaultValues: {
			target: 'example.com',
			scanProfile: 'safe',
			confirmAuthorized: true,
		},
	});

	const targetValue = useWatch({ control, name: 'target' });
	const scanProfile = useWatch({ control, name: 'scanProfile' });
	const confirmAuthorized = useWatch({ control, name: 'confirmAuthorized' });
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
					<p className={styles.eyebrow}>{t('Scan orchestration', 'Управление сканированием')}</p>
					<h2>{t('Start an authorized scan', 'Запустить разрешённое сканирование')}</h2>
				</div>
				<span className={styles.badge}>{t('Live queue', 'Активная очередь')}: {activeQueueCount.toString().padStart(2, '0')}</span>
			</div>

			<div className={styles.presetRow}>
				{LAB_TARGET_PRESETS.map((preset) => (
					<button
						key={preset.target}
						type="button"
						className={styles.presetButton}
						onClick={() => {
							setValue('target', preset.target, { shouldDirty: true, shouldTouch: true });
							setValue('scanProfile', preset.profile, { shouldDirty: true, shouldTouch: true });
							clearErrors('target');
						}}
					>
						<strong>{translatePreset(preset.label, language)}</strong>
						<span>{preset.target}</span>
					</button>
				))}
			</div>

			<form className={styles.form} onSubmit={submitForm}>
				<label className={styles.field}>
					<span>{t('Target', 'Цель')}</span>
					<input
						type="text"
						placeholder="example.com"
						{...register('target')}
						aria-invalid={errors.target ? 'true' : 'false'}
					/>
					{errors.target ? <span className={styles.fieldError}>{errors.target.message}</span> : null}
				</label>

				<div className={styles.field}>
					<span>{t('Scan profile', 'Профиль сканирования')}</span>
					<ScanProfileDropdown value={scanProfile} onChange={(profile) => setValue('scanProfile', profile, { shouldDirty: true, shouldValidate: true })} />
					{errors.scanProfile ? (
						<span className={styles.fieldError}>{errors.scanProfile.message}</span>
					) : null}
				</div>

				<label className={styles.checkbox}>
					<input type="checkbox" {...register('confirmAuthorized')} />
					<span>{t('I confirm that I own this target or have explicit authorization to test it.', 'Подтверждаю, что владею этой целью или имею явное разрешение на её проверку.')}</span>
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
						{isSubmitting ? t('Starting scan...', 'Запуск сканирования...') : t('Start scan', 'Запустить сканирование')}
					</button>
				</div>
			</form>
		</section>
	);
}

function translatePreset(label: string, language: 'en' | 'ru') {
	if (language === 'en') return label;
	return {
		'Full local perimeter': 'Весь локальный периметр',
		'Admin service': 'Административный сервис',
		'Legacy service': 'Устаревший сервис',
		'File service': 'Файловый сервис',
	}[label] ?? label;
}
