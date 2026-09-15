import { Languages } from 'lucide-react';
import { useLanguage, type Language } from './useLanguage';
import styles from './LanguageSwitch.module.scss';

export function LanguageSwitch() {
	const { language, setLanguage, t } = useLanguage();
	return (
		<div className={styles.control} role="group" aria-label={t('Interface language', 'Язык интерфейса')}>
			<Languages size={15} aria-hidden="true" />
			{(['ru', 'en'] as Language[]).map((item) => (
				<button key={item} type="button" className={language === item ? styles.active : ''} onClick={() => setLanguage(item)} aria-pressed={language === item}>
					{item.toUpperCase()}
				</button>
			))}
		</div>
	);
}
