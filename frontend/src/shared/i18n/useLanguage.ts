import { createContext, useContext } from 'react';

export type Language = 'en' | 'ru';

export interface LanguageValue {
	language: Language;
	setLanguage: (language: Language) => void;
	t: (english: string, russian: string) => string;
}

export const LanguageContext = createContext<LanguageValue | null>(null);

export function useLanguage() {
	const value = useContext(LanguageContext);
	if (!value) throw new Error('useLanguage must be used inside LanguageProvider');
	return value;
}
