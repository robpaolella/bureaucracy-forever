# Searchable reserve picker

Issue: #96. Approved design: `design/118-reserve-picker`, revision 1/B2, merged in #127.

Replace the two native reserve selects inside the existing form with slot cards, a searchable item list and explicit Choose/Remove details. Keep saving, role gates and reserve rules unchanged. Names/totals belong to #109; the window and summary belong to #119.

Done means the issue's logic tests, keyboard/touch and persistence/error checks pass; main/build/approved images are compared at 390 and 1440; independent design and code reviews pass; a PR closes #96. No merge without Robert.
