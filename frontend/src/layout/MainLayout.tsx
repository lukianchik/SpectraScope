import { ShieldAlert } from 'lucide-react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAdversaryMode } from '../shared/adversary/useAdversaryMode';
import { useScansList } from '../shared/hooks/useScansData';
import { LanguageSwitch } from '../shared/i18n/LanguageSwitch';
import { useLanguage } from '../shared/i18n/useLanguage';
import { demoIsActive } from '../shared/mock/demoData';
import { logout } from '../shared/api/auth';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Sidebar } from '../widgets/Sidebar/Sidebar';
import styles from './MainLayout.module.scss';

export function MainLayout() {
	useScansList();
	const demo = demoIsActive();
	const { active } = useAdversaryMode();
	const { t } = useLanguage();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const logoutMutation = useMutation({
		mutationFn: logout,
		onSuccess: () => {
			queryClient.clear();
			navigate('/login', { replace: true });
		},
	});

	return (
		<div className={styles.layout} data-testid="main-layout">
			<Sidebar />
			<main className={styles.main}>
				<div className={`${styles.utilityBar} ${active ? styles.utilityBarActive : ''}`}>
					{active ? (
						<div className={styles.adversaryNotice} role="status" data-testid="adversary-center-warning">
							<ShieldAlert size={17} />
							<span>
								<strong>{t('ADVERSARY SIMULATION', 'СИМУЛЯЦИЯ ПРОТИВНИКА')}</strong>
								<small>{t('Authorized targets only. No exploits or autonomous actions are executed.', 'Только разрешённые цели. Эксплойты и автономные действия не выполняются.')}</small>
							</span>
						</div>
					) : <span />}
					<div className={styles.sessionActions}>
						<LanguageSwitch />
						<button type="button" onClick={() => logoutMutation.mutate()} disabled={logoutMutation.isPending}>{t('Sign out', 'Выйти')}</button>
					</div>
				</div>
				{demo ? (
					<div className={styles.demoBanner} data-testid="demo-banner">
						<span><span className={styles.dot} />{t('Backend is unavailable. Showing simulated data.', 'Backend недоступен. Показаны симулированные данные.')} <strong>{t('No live scan is running.', 'Реальный скан не выполняется.')}</strong></span>
					</div>
				) : null}
				<Outlet />
			</main>
		</div>
	);
}
