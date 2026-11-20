# Einbindungsauftrag: RateLama-Gamification

## Ablage und Laden
1. Zuerst Repository-Anweisungen und aktuelle Komponenten lesen; dieses Paket nicht als Quellcode ausführen.
2. Nur `public/assets/gamification/` in die produktive Asset-Struktur kopieren. Manifest/Dokumentation können unter `spec/ratelama-gamification/` liegen; die App lädt nicht aus `spec/`.
3. App-Pfade ohne `public/` referenzieren, etwa `assets/gamification/icons/rank-up.svg`, und wie `Avatar` `import.meta.env.BASE_URL` voranstellen. Keine externen URLs.
4. Typisierte Zuordnung bekannter Icon- und Badge-IDs verwenden, keine Server-Strings zu Pfaden zusammensetzen. SVG bevorzugt per `<img>` laden; PNG-Exporte als lokale Alternative. Illustrationen 512er-Quelle mit 1024er-`srcSet` für 2x.
5. Feste Maße/`aspect-ratio: 1`, `object-fit: contain`. Unbekannte Badge-ID: Text erhalten und `badge-generic` zeigen. Ladefehler: bisheriger lokaler Fallback und Status bleiben.

## Komponenten-Zuordnung

| Ziel | Asset-Verwendung |
|---|---|
| `Achievements` | `streak-idle` unter 3, `streak-active` ab 3; vier fachliche Badges nach ID statt generischem `Award`; Text/Balken behalten. |
| `ScoreAward` | `points` beim Gewinn, `streak-active` bei echtem Bonus, `streak-milestone` im Meilenstein; konkretes Badge im Badge-Popup. |
| `RankRise` / `RankChange` | `rank-up`, `rank-down`, `rank-steady`; Platzanzahl und Text erhalten, keine Verlustanimation. |
| `Podium` | `crown` bei allen tatsächlichen Rang-1-Spielern; `streak-active` statt Feuer-Emoji; dynamische Podesthöhe und Avatare behalten. |
| Persönliches `Ranking` | `trophy` als Sticker; Rang bleibt Text, keine Siegerillustration bei beliebigem Rang. |
| `Finale` | `trophy` und sparsame Illustration; `finale-winner` nur nach bestätigtem Sieg, sonst `finale-participant`. |
| `Reveal` | Richtig: `answer-correct`/optional `answer-celebrate`; falsch: `answer-incorrect`/optional `answer-encourage`; keine Antwort: `timer`. |
| `AnswerTiles` / Antwortfeedback | Bestätigte Speicherung: `answer-saved`; ausstehend: `timer`. Speicherung sagt nichts über Richtigkeit aus. |
| `Timer` / Countdown | `timer`; `ready` im Bereitschaftssticker, optional `countdown-ready`; Zahlen und Fristlogik bleiben Text/Code. |
| `SpeedBonus` | `speed` statt `Zap`; Bonuszahl und Balken unverändert. |
| Lobby | Optional `lobby-welcome`, ohne Avatar, Namen, Zähler, Code oder QR zu verdrängen. |
| Link-Quiz und `AsyncStandingsPresentation` | Gemeinsame Komponenten/Assets für Antwortpause, Admin, Zwischenstand und Vollbild wiederverwenden. |

## Semantik und Verhalten
- Während versteckter Auflösung keine erfolgsabhängigen Bilder, Serien oder Badges zeigen. Bei unbekanntem Ergebnis nur `answer-saved`/`ready`.
- Vollständiger persönlicher Abschluss einer noch aktiven Runde erhält `finale-participant`, auch bei vorläufigem Rang 1. `finale-winner` erst nach endgültig bestätigtem Rang 1.
- Gemeinsames Finale nutzt die allgemeine Illustration; Krone markiert Podiums-Rang 1, ohne Betrachter als Sieger anzusprechen.
- `PERFECT` nur anhand serverseitig bestätigter vollständiger Teilnahme mit ausschließlich richtigen Antworten. Gleichstände und echte Serverränge erhalten; nie Rang aus Listenposition berechnen.
- Falsche Antwort, Abbruch, unvollständige Teilnahme, Verbindungsfehler oder fehlendes Ergebnis lösen keine Siegerfeier/Punktefeier aus.
- Serienbonus bleibt optional (3. richtig +100, 4. +150, ab 5. +200); Fehler/fehlende Antwort unterbricht Serie. Badges geben keine Punkte. Sofortauflösung bleibt separat schaltbar.

## Barrierefreiheit und Abnahme
Bestehende `motion/react`, CSS- und `AnswerCelebration`-Animationen sowie Ereignis-IDs/`claimGameEvent` erhalten; keine neue Animationsbibliothek und keine Wiederholung bei Refresh/Reconnect. Bei `prefers-reduced-motion: reduce` keine Partikel, Zählerfahrt, Positionsbewegung, Pulsieren oder Rotieren. Dekorative Bilder mit `alt=""`/`aria-hidden="true"`; Statusrollen, Fokus und Ergebnistext erhalten. Startseite, Branding, Gastidentität, Avatare, Punkteberechnung, Backend, GraphQL, gespeicherte Badges und historische Regeln unverändert lassen. Keine Abhängigkeiten, externen Dienste, Tracking, Commit, Push oder Deployment.

Abnahme: alle 26 Motive korrekt und ohne kaputte Pfade/Layouts; Live- und Link-Quiz mit richtig/falsch/keiner Antwort/gespeichert-unaufgelöst, Bonus an/aus, vier Badges, Reveal an/aus, Zwischenstand, Rangänderungen, Gleichstände, endgültiger Sieg/normaler Abschluss prüfen. Keine Events bei Refresh/Reconnect. 320/390/430 px, Admin/Desktop, Präsentation 1920 px, Reduced Motion und lokale Fallbacks prüfen. Vorhandene Typecheck-, Lint-, Build- und passende Browserprüfungen ausführen; nichts deployen.

```text
Integriere spec/ratelama-gamification/INTEGRATION.md und die gelieferten Assets in das bestehende RateLama-Repository. Prüfe zuerst die aktuellen Komponenten und Repository-Anweisungen. Verwende die individuellen Symbole, die vier Abzeichen mit unveränderten fachlichen IDs und sparsam die sechs Lama-Illustrationen. Berücksichtige Live-Quiz, Link-Quiz, Antwortpause, Zwischenstände, Podium, persönlichen Abschluss und Vollbild-Endstand. Erhalte Serverwertungen, Reveal-Schutz, Gleichstände, bestehende Ereignissperren, Avatare, Fokusführung und Reduced Motion. Keine neuen Spielregeln oder Abhängigkeiten, kein Commit, Push oder Deployment. Prüfe Darstellung und vorhandene passende Tests und melde verbleibende Einschränkungen ausdrücklich.
```
