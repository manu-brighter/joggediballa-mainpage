# Archiv: Harassenlauf-Anmeldeformular (temp button)

Archiviert am 2026-07-16. Anmeldefrist für den Harassenlauf 2026 ist abgelaufen.

## Was das war

Ein temporäres Anmeldeformular für den Harassenlauf, erreichbar über die Route
`/harassenlauf`. Sichtbarkeit wurde über den generischen Feature-Toggle
`temp_button` gesteuert:

- Homepage-CTA-Button in `client/src/pages/Home.tsx`
- Nav-Link in `client/src/components/Navigation.tsx`
- Admin-Toggle im Dashboard (`client/src/pages/admin/Dashboard.tsx`)

Alle drei Stellen wurden entfernt. Die Route `/harassenlauf` existiert weiterhin
(siehe `client/src/App.tsx`), zeigt aber nur noch einen simplen Hinweis
("Anmeldefrist vorbei") statt des Formulars.

## Was archiviert ist

`Harassenlauf.tsx.old` — die vollständige Original-Formular-Komponente
(Team-Anmeldung, Wurstbestellung, Regeln-Akkordeon, Flyer-Download etc.).

## Backend (unverändert, weiterhin live)

Das Formular-Backend wurde **nicht** entfernt und bleibt technisch funktionsfähig:

- `harassenlauf` tRPC-Router in `server/routers.ts` (`harassenlauf.register`)
- `harassenlaufRegistrations`-Tabelle in `drizzle/schema.ts`
- `sendHarassenlaufEmail` in `server/_core/email.ts`

Diese sind nach der Entfernung des Frontends einfach unbenutzt (kein Aufruf
mehr aus der UI). Falls der Anlass 2027 wiederkommt, kann das Formular aus
diesem Archiv zurückgeholt und der `temp_button`-Toggle in den drei oben
genannten Stellen wieder verdrahtet werden.

## Cleanup-Hinweis

Der Feature-Toggle-Eintrag `temp_button` in der `feature_toggles`-Tabelle wird
nicht mehr referenziert und kann bei Bedarf manuell entfernt werden.
