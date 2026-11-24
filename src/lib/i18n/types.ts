export type UserLocale = 'en' | 'vi';

export type SupportedCurrency =
  | 'VND'
  | 'USD'
  | 'EUR'
  | 'GBP'
  | 'AUD'
  | 'SGD'
  | 'CAD'
  | 'JPY'
  | 'KRW';

export type PreferenceDetectionSource =
  | 'cookie'
  | 'geo_header'
  | 'geoip'
  | 'accept_language'
  | 'default';

export interface UserPreferences {
  locale: UserLocale;
  currency: SupportedCurrency;
  detectedCountry: string;
  detectedIp: string;
  detectionSource: PreferenceDetectionSource;
  isAutoLocale: boolean;
  isAutoCurrency: boolean;
}
