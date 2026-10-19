// Voltra's public contact details (from voltra.in). Override at build time with VITE_* variables if needed.
export const COMPANY = {
  name: 'Voltra Technologies Pvt. Ltd.',
  address: '3rd Floor, Orchid Center, Golf Course Road, Sector-53, Gurugram, India',
  phone: import.meta.env.VITE_SUPPORT_PHONE || '+91 99929 29203',
  email: import.meta.env.VITE_SUPPORT_EMAIL || 'info@voltra.in',
  website: 'https://voltra.in',
  // Service & maintenance (faults, WiFi, replacements): person of contact.
  service: { name: 'Amish Sharma', phone: import.meta.env.VITE_SERVICE_PHONE || '+91 70181 52711' },
  warrantyUrl: import.meta.env.VITE_WARRANTY_URL || '',
};
export const telHref = (p) => `tel:${p.replace(/[^\d+]/g, '')}`;
