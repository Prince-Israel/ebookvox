// The Ebookvox mark: an open book whose pages open into rising sound waves — "Your Words. Our Voice."
export function logoMarkSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8a5a44"/><stop offset="1" stop-color="#3f2a1f"/></linearGradient>
    <linearGradient id="p" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6a67a"/><stop offset="1" stop-color="#ee8a5a"/></linearGradient>
  </defs>
  <rect width="64" height="64" rx="16" fill="url(#g)"/>
  <g stroke="#f6a67a" stroke-width="3.2" stroke-linecap="round">
    <line x1="20" y1="19" x2="20" y2="23"/><line x1="26" y1="14" x2="26" y2="26"/><line x1="32" y1="9" x2="32" y2="28"/><line x1="38" y1="14" x2="38" y2="26"/><line x1="44" y1="19" x2="44" y2="23"/>
  </g>
  <path d="M32 54c-6-4-15-5-23-3V31c8-2 17-1 23 3z" fill="#fbf1e4"/>
  <path d="M32 54c6-4 15-5 23-3V31c-8-2-17-1-23 3z" fill="#f3dfc9"/>
  <path d="M32 34v20" stroke="#6b4a3a" stroke-width="1.4" stroke-linecap="round"/>
</svg>`;
}
