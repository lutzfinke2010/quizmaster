# RateLama-Maskottchen · Asset-Spec

Drei einzeln nutzbare Lama-PNGs im freundlichen RateLama-Look. Die Grafiken haben einen transparenten Hintergrund und sind für Fragen-, Feedback- und Ergebnisseiten gedacht.

## Dateien

| Datei | Motiv | Einsatz |
|---|---|---|
| `assets/mascots/lama-winken.png` | Freundlich winkendes Lama | Begrüßung, Quizstart, leere Zustände |
| `assets/mascots/lama-daumenhoch.png` | Zufriedenes Lama mit Daumen-hoch-Geste | Richtige Antwort, Ermutigung, Erfolg |
| `assets/mascots/lama-jubel.png` | Lama jubelt mit erhobenen Armen | Quizabschluss, Punktegewinn, Belohnung |

Die Figuren wurden als separate transparente Grafiken im Stil der gezeigten RateLama-Mockups neu aufbereitet. Sie sind keine pixelgenauen Ausschnitte aus den Smartphone-Screens.

## Einbau in React

Lege den Ordner `assets/mascots` in einer Vite- oder Create-React-App unter `public/assets/ratelama/mascots` ab. Dateien in `public` lassen sich über einen Pfad ab der Web-App-Wurzel laden.

### Wiederverwendbare React-Komponente

```tsx
import type { CSSProperties } from 'react';

type MascotState = 'intro' | 'correct' | 'celebration';

type RateLamaMascotProps = {
  state: MascotState;
  className?: string;
};

const mascotFiles: Record<MascotState, string> = {
  intro: '/assets/ratelama/mascots/lama-winken.png',
  correct: '/assets/ratelama/mascots/lama-daumenhoch.png',
  celebration: '/assets/ratelama/mascots/lama-jubel.png'
};

const mascotDescriptions: Record<MascotState, string> = {
  intro: 'RateLama begrüßt dich',
  correct: 'RateLama freut sich über die richtige Antwort',
  celebration: 'RateLama jubelt zum Quizabschluss'
};

export function RateLamaMascot({ state, className = '' }: RateLamaMascotProps) {
  return (
    <img
      className={`quiz-mascot ${className}`.trim()}
      src={mascotFiles[state]}
      alt={mascotDescriptions[state]}
      draggable={false}
    />
  );
}
```

Beispiel für den Antwortzustand:

```tsx
<RateLamaMascot state={isQuizFinished ? 'celebration' : isCorrect ? 'correct' : 'intro'} />
```

### CSS

```css
.quiz-mascot {
  display: block;
  width: min(42vw, 240px);
  height: auto;
  object-fit: contain;
}

@media (prefers-reduced-motion: no-preference) {
  .quiz-mascot {
    animation: mascot-enter 280ms ease-out both;
  }
}

@keyframes mascot-enter {
  from { opacity: 0; transform: translateY(8px) scale(.96); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
```

### Hinweise

- PNG mit transparentem Hintergrund verwenden; kein zusätzliches `background-color` setzen.
- In Karten und Feedbackbereichen `object-fit: contain` nutzen, damit Ohren und Füße sichtbar bleiben.
- Auf kleinen Displays die Breite begrenzen und die Höhe automatisch berechnen lassen.
- Wenn das Lama rein dekorativ ist, `alt=""` setzen. Bei einer inhaltlichen Reaktion einen passenden Alternativtext verwenden.
- Bei Create React App kann statt des `public`-Pfads auch aus `src/assets` importiert werden. Für Vite und Create React App funktioniert die oben gezeigte `public`-Variante ohne zusätzliche Loader.

## Technische Daten

Die PNGs sind hochauflösende RGBA-Dateien mit transparentem Hintergrund. Exakte Pixelmaße und Zustandszuordnungen stehen in `spec/assets.json`. Die Figuren sind mittig und vollständig im Bildrahmen angelegt.
