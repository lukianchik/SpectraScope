import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { LanguageContext, type Language } from './useLanguage';

const STORAGE_KEY = 'spectrascope-language';

export function LanguageProvider({ children }: { children: ReactNode }) {
	const [language, setLanguage] = useState<Language>(() => localStorage.getItem(STORAGE_KEY) === 'ru' ? 'ru' : 'en');

	useEffect(() => {
		localStorage.setItem(STORAGE_KEY, language);
		document.documentElement.lang = language;
	}, [language]);

	const value = useMemo(
		() => ({ language, setLanguage, t: (english: string, russian: string) => language === 'ru' ? russian : english }),
		[language],
	);

	return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}
