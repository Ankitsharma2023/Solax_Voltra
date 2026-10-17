// Voltra's public contact details (copy of the web app's src/company.js). Override with EXPO_PUBLIC_* variables.
export const COMPANY = {
  name: 'Voltra Technologies Pvt. Ltd.',
  address: '3rd Floor, Orchid Center, Golf Course Road, Sector-53, Gurugram, India',
  phone: process.env.EXPO_PUBLIC_SUPPORT_PHONE || '+91 99929 29203',
  email: process.env.EXPO_PUBLIC_SUPPORT_EMAIL || 'info@voltra.in',
  website: 'https://voltra.in',
  warrantyUrl: process.env.EXPO_PUBLIC_WARRANTY_URL || '',
};
export const telHref = (p) => `tel:${p.replace(/[^\d+]/g, '')}`;
