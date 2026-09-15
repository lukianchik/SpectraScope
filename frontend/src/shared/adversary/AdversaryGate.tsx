import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Eye, ShieldCheck, Swords, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAdversaryMode } from './useAdversaryMode';
import styles from './AdversaryGate.module.scss';
import { useLanguage } from '../i18n/useLanguage';

export function AdversaryGate() {
	const { active, enable, disable } = useAdversaryMode();
	const [open, setOpen] = useState(false);
	const [authorized, setAuthorized] = useState(false);
	const navigate = useNavigate();
	const { t } = useLanguage();

	const closeGate = () => {
		setOpen(false);
		setAuthorized(false);
	};

	useEffect(() => {
		if (!open) return;

		const previousOverflow = document.body.style.overflow;
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				setOpen(false);
				setAuthorized(false);
			}
		};

		document.body.style.overflow = 'hidden';
		document.addEventListener('keydown', handleKeyDown);

		return () => {
			document.body.style.overflow = previousOverflow;
			document.removeEventListener('keydown', handleKeyDown);
		};
	}, [open]);

	const leaveMode = () => {
		disable();
		navigate('/dashboard');
	};

	return (
		<>
		<button
			type="button"
			className={`${styles.trigger} ${active ? styles.active : ''}`}
			onClick={() => (active ? leaveMode() : setOpen(true))}
			aria-pressed={active}
			data-testid="adversary-mode-toggle"
		>
			{active ? <ShieldCheck size={17} /> : <Eye size={17} />}
			<span>
				<strong>{active ? t('Exit Adversary View', 'Выйти из режима противника') : t('Adversary View', 'Режим противника')}</strong>
				<small>{active ? t('Return to defensive posture', 'Вернуться к защите') : t('Model paths, do not execute', 'Моделирование без выполнения атак')}</small>
			</span>
		</button>

		{open ? createPortal(
			<div className={styles.backdrop} role="presentation" onMouseDown={closeGate}>
				<section
					className={styles.dialog}
					role="dialog"
					aria-modal="true"
					aria-labelledby="adversary-title"
					onMouseDown={(event) => event.stopPropagation()}
				>
					<button className={styles.close} type="button" onClick={closeGate} aria-label={t('Close', 'Закрыть')}>
						<X size={18} />
					</button>
					<div className={styles.icon}><Swords size={24} /></div>
					<p className={styles.kicker}>{t('Controlled simulation', 'Контролируемая симуляция')}</p>
					<h2 id="adversary-title">{t('Enter Adversary View?', 'Включить режим противника?')}</h2>
					<p>
						{t('This workspace models plausible attack paths from scanner evidence. It does not run exploits, payloads, or autonomous actions.', 'Этот режим моделирует вероятные цепочки атак по данным сканера. Он не запускает эксплойты, payload или автономные действия.')}
					</p>
					<label className={styles.confirm}>
						<input type="checkbox" checked={authorized} onChange={(event) => setAuthorized(event.target.checked)} />
						<span>{t('I am reviewing systems I own or have explicit authorization to assess.', 'Я проверяю собственные системы или имею явное разрешение владельца.')}</span>
					</label>
					<div className={styles.actions}>
						<button type="button" className={styles.cancel} onClick={closeGate}>{t('Cancel', 'Отмена')}</button>
						<button
							type="button"
							className={styles.enter}
							disabled={!authorized}
							onClick={() => {
								enable();
								setOpen(false);
								navigate('/attack-paths');
							}}
						>
							<Swords size={16} /> {t('Enter view', 'Включить режим')}
						</button>
					</div>
				</section>
			</div>,
			document.body,
		) : null}
		</>
	);
}
