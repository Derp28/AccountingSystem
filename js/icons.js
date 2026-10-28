const ICONS = {
  dashboard:
    '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  accounts:
    '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 5.5v15"/><path d="M8 7h8M8 11h6"/>',
  transactions:
    '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
  journal:
    '<path d="M12 6.5C10 4.9 7.5 4.5 4 5v14c3.5-.5 6-.1 8 1.5 2-1.6 4.5-2 8-1.5V5c-3.5-.5-6-.1-8 1.5z"/><path d="M12 6.5v14"/>',
  adjustments:
    '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h9M17 18h3"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="15" cy="18" r="2"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  "chevron-down": '<path d="M6 9l6 6 6-6"/>',
  "chevron-right": '<path d="M9 6l6 6-6 6"/>',
  edit: '<path d="M4 20h4l10-10-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6"/><path d="M6 7l1 13h10l1-13"/><path d="M9 7V4h6v3"/>',
  eye: '<path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z"/><circle cx="12" cy="12" r="2.6"/>',
  check: '<path d="M4.5 12.5l5 5 10-11"/>',
  "check-circle": '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.7 2.7L16.5 9"/>',
  alert: '<path d="M12 3l9 17H3z"/><path d="M12 9v5M12 17h.01"/>',
  "alert-circle": '<circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16.5h.01"/>',
  "x-circle": '<circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  "arrow-up-right": '<path d="M7 17L17 7M8 7h9v9"/>',
  "arrow-down-left": '<path d="M17 7L7 17M16 17H7V8"/>',
  "arrow-left": '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  "arrow-right": '<path d="M5 12h14M13 6l6 6-6 6"/>',
  wallet:
    '<path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H19v14H6.5A2.5 2.5 0 0 1 4 16.5z"/><path d="M4 8h15"/><path d="M16 12h3"/>',
  scale:
    '<path d="M12 4v16M7 20h10M5 7h14"/><path d="M5 7l-3 6h6zM19 7l-3 6h6z"/>',
  spark: '<path d="M12 3l1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7z"/>',
  user: '<circle cx="12" cy="8" r="3.2"/><path d="M5 20c.8-4 3.2-6 7-6s6.2 2 7 6"/>',
  settings:
    '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4v-.2a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1z"/>',
  reverse: '<path d="M4 9h11a5 5 0 0 1 0 10H9"/><path d="M8 5L4 9l4 4"/>',
  ban: '<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/>',
  more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  lock: '<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  save: '<path d="M5 4h12l2 2v14H5z"/><path d="M8 4v5h7V4M8 20v-6h8v6"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2.3 6.2"/><path d="M20 4v7h-7"/>',
  coins: '<ellipse cx="9" cy="7" rx="5" ry="2.5"/><path d="M4 7v4c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5V7"/><path d="M4 11v4c0 1.4 2.2 2.5 5 2.5 1.2 0 2.3-.2 3.1-.6"/><ellipse cx="16" cy="15" rx="4" ry="2"/><path d="M12 15v3c0 1.1 1.8 2 4 2s4-.9 4-2v-3"/>',
  ledger:
    '<path d="M5 3h14v18H5z"/><path d="M9 3v18M12 7h4M12 11h4M12 15h2"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v4h16v-4"/>',
};

export function icon(name, size = 18, className = "") {
  const body = ICONS[name] || ICONS.info;
  return `<svg class="icon ${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
}

export function brandMark(size = 22) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
    <path d="M5 3.5h11.5L20 7v13.5H5z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M8 3.5v6h7v-6M8 16h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M15 3.5V7h3" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
  </svg>`;
}
