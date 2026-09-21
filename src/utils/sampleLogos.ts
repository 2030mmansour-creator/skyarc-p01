// Sample Professional SVG Logos for Contracting, Construction & Engineering Enterprises

export interface PresetLogo {
  id: string;
  name: string;
  category: string;
  dataUri: string;
}

export const PRESET_LOGOS: PresetLogo[] = [
  {
    id: 'arch-emerald',
    name: 'أبراج وهندسة معمارية',
    category: 'هندسة ومشاريع',
    dataUri: `data:image/svg+xml;utf8,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
        <defs>
          <linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#059669"/>
            <stop offset="100%" stop-color="#0d9488"/>
          </linearGradient>
          <linearGradient id="g2" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#10b981"/>
            <stop offset="100%" stop-color="#34d399"/>
          </linearGradient>
        </defs>
        <rect width="200" height="200" rx="40" fill="url(#g1)"/>
        <!-- Tower 1 -->
        <path d="M55 155 L55 85 L85 60 L85 155 Z" fill="#ffffff" opacity="0.95"/>
        <!-- Tower 2 Tall -->
        <path d="M90 155 L90 40 L125 40 L125 155 Z" fill="#ffffff"/>
        <!-- Tower 3 Right -->
        <path d="M130 155 L130 75 L150 90 L150 155 Z" fill="#ffffff" opacity="0.85"/>
        <!-- Windows accents -->
        <line x1="97" y1="58" x2="118" y2="58" stroke="#059669" stroke-width="3" stroke-linecap="round"/>
        <line x1="97" y1="72" x2="118" y2="72" stroke="#059669" stroke-width="3" stroke-linecap="round"/>
        <line x1="97" y1="86" x2="118" y2="86" stroke="#059669" stroke-width="3" stroke-linecap="round"/>
        <line x1="97" y1="100" x2="118" y2="100" stroke="#059669" stroke-width="3" stroke-linecap="round"/>
        <!-- Foundation line -->
        <rect x="40" y="155" width="120" height="8" rx="4" fill="#ffffff"/>
      </svg>
    `)}`
  },
  {
    id: 'build-amber',
    name: 'مقاولات وإنشاءات عامة',
    category: 'مقاولات وبناء',
    dataUri: `data:image/svg+xml;utf8,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
        <defs>
          <linearGradient id="bgAmber" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#0f172a"/>
            <stop offset="100%" stop-color="#1e293b"/>
          </linearGradient>
          <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#f59e0b"/>
            <stop offset="100%" stop-color="#fbbf24"/>
          </linearGradient>
        </defs>
        <rect width="200" height="200" rx="40" fill="url(#bgAmber)"/>
        <!-- Hexagon Badge -->
        <polygon points="100,30 160,65 160,135 100,170 40,135 40,65" fill="none" stroke="url(#goldGrad)" stroke-width="6" stroke-linejoin="round"/>
        <!-- Crane / Geometric Structure -->
        <path d="M70 140 L100 65 L130 140 Z" fill="none" stroke="#ffffff" stroke-width="6" stroke-linejoin="round"/>
        <line x1="82" y1="110" x2="118" y2="110" stroke="url(#goldGrad)" stroke-width="5"/>
        <circle cx="100" cy="65" r="7" fill="url(#goldGrad)"/>
      </svg>
    `)}`
  },
  {
    id: 'corp-blue',
    name: 'إدارة واستثمار وتطوير',
    category: 'تطوير عقاري واستثمار',
    dataUri: `data:image/svg+xml;utf8,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
        <defs>
          <linearGradient id="corpGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#1e40af"/>
            <stop offset="100%" stop-color="#0284c7"/>
          </linearGradient>
        </defs>
        <rect width="200" height="200" rx="40" fill="url(#corpGrad)"/>
        <!-- Interlocking Rings / Modern Diamond -->
        <path d="M100 45 L150 95 L100 145 L50 95 Z" fill="none" stroke="#ffffff" stroke-width="8" stroke-linejoin="round"/>
        <path d="M100 65 L130 95 L100 125 L70 95 Z" fill="#38bdf8" opacity="0.9"/>
        <circle cx="100" cy="95" r="10" fill="#ffffff"/>
      </svg>
    `)}`
  },
  {
    id: 'crest-gold',
    name: 'شعار الجودة والاعتماد',
    category: 'مؤسسي واحترافي',
    dataUri: `data:image/svg+xml;utf8,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
        <defs>
          <linearGradient id="crestBg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#064e3b"/>
            <stop offset="100%" stop-color="#047857"/>
          </linearGradient>
        </defs>
        <rect width="200" height="200" rx="40" fill="url(#crestBg)"/>
        <!-- Shield -->
        <path d="M100 40 C140 40 155 55 155 90 C155 130 115 155 100 165 C85 155 45 130 45 90 C45 55 60 40 100 40 Z" fill="none" stroke="#fbbf24" stroke-width="7" stroke-linejoin="round"/>
        <!-- Star or Check inside -->
        <path d="M80 98 L94 112 L124 82" fill="none" stroke="#ffffff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `)}`
  }
];
