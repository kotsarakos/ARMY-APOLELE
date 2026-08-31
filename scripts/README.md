# Έλεγχοι σε πραγματικό browser

Τρέχουν με headless Chromium μέσω `playwright-core`. Χρειάζονται:

```bash
npm run build
npx vite preview --port 4173 &   # οι έλεγχοι χτυπούν το :4173
npm run audit
```

| Script | Τι ελέγχει |
|---|---|
| `audit-mobile.mjs` | Οριζόντια υπερχείλιση σε 320/360/390/414/768px σε κάθε οθόνη, μέγεθος πεδίων ≥16px (αλλιώς το iOS κάνει auto-zoom), στόχοι αφής ≥44px |
| `audit-functional.mjs` | Ανίχνευση/εναλλαγή γλώσσας, ενημέρωση meta description και title, μηνύματα επιτυχίας/σφάλματος, επιμονή δεδομένων, 404, απόρρητο, κλείδωμα ζουμ |
| `audit-fonts.mjs` | Ότι display και mono γραμματοσειρές καλύπτουν **ελληνικά** glyphs και δεν κάνουν σιωπηλό fallback |

Ο έλεγχος γραμματοσειρών υπάρχει επειδή ένα σιωπηλό fallback δεν σπάει τίποτα —
απλώς βγάζει τους ελληνικούς τίτλους σε λάθος γραμματοσειρά. Το Oswald και το
IBM Plex Mono έπεσαν ακριβώς σε αυτή την παγίδα.

Αν το `chromium-1148` δεν υπάρχει τοπικά: `npx playwright install chromium`.
