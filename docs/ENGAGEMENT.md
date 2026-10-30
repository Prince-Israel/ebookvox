# Keeping readers coming back

## "Continue where you stopped"
- Home opens with a card for the book the reader was last in the middle of (progress bar, one tap to continue).
- The weekly email (below) carries the same card.

## Weekly email: continue where you stopped + new books
`POST /api/cron/digest` emails each reader who has something to come back to: the book they stopped in, and up to 3 books added in the last 14 days that they don't have yet.
It skips readers who were active in the last 3 days, who got one in the last 6 days, who haven't verified their email, or who turned off "New books" in Settings.

1. Put a long random value in the Reader `.env`: `CRON_SECRET="..."` (and set up SMTP so mail is really sent). Restart the Reader.
2. DirectAdmin → **Cron Jobs** → add a weekly job, for example every Saturday 09:00:
   ```
   curl -s -X POST -H "x-cron-secret: YOUR_CRON_SECRET" https://app.ebookvox.com/api/cron/digest
   ```
3. Check first with `?dry=1` on the URL: it only reports how many emails would be sent.

New-book notifications inside the app already exist (the bell icon); they follow the same "New books" setting.

## Review prompt
When a reader on Android finishes a book, the app asks "Are you enjoying Ebookvox?". Happy readers are sent to the Ebookvox page on Google Play to leave a review. It asks at most once every 60 days, and never again after "Don't ask again".
