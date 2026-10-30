# Search engine optimisation (SEO)

## What is built in
- **Every book has its own page** (`/books/<id>`), server-rendered: a unique title and description, the cover, a canonical address, share previews (Open Graph and Twitter cards) and structured data (schema.org `Book` and breadcrumbs).
- **Category pages** (`/category`, `/category/<name>`) and **author pages** (`/authors/<name>`): crawlable lists of books with paging, breadcrumbs and an item list in structured data.
- **Tool pages** for the searches people make: `/text-to-speech` and `/pdf-to-audio`. Visitors can hear a free 400-character sample without an account, and the pages carry FAQ structured data.
- **`/sitemap.xml`**: every public page, category, author with 2+ books, and every approved book (refreshed hourly).
- **`/robots.txt`**: blocks the API and private screens (library, wallet, orders, settings, sign-in, reader), allows book covers, and points to the sitemap. Private and sign-in pages also send `X-Robots-Tag: noindex`.
- Home, Books and Subscribe have their own titles, descriptions and canonical addresses; Home also carries Organization, WebSite and SoftwareApplication data.

## What you must do (free, about 30 minutes)
1. **Google Search Console** (https://search.google.com/search-console): add `https://app.ebookvox.com` as a property. Choose "HTML tag" verification, copy the code, put it in the Reader `.env` as `GOOGLE_SITE_VERIFICATION="..."`, restart, then click Verify.
2. In Search Console → **Sitemaps**, submit `sitemap.xml`.
3. **Bing Webmaster Tools** (https://www.bing.com/webmasters): add the site (you can import it from Search Console) and set `BING_SITE_VERIFICATION` if it asks for a tag. Bing also feeds DuckDuckGo and Yahoo.
4. Make sure the server has `APP_URL=https://app.ebookvox.com` exactly: every canonical address, sitemap entry and share preview is built from it.
5. After deploying, check a book page with Google's **Rich Results Test** (https://search.google.com/test/rich-results) and share a book link in WhatsApp to see the preview.

## Keeping it healthy
- New books appear in the sitemap automatically (within the hour).
- In Search Console, watch **Pages** (what is indexed and why not) and **Performance** (which searches bring visitors).
- Indexing a brand-new site takes days to weeks, and ranking takes months. Backlinks (other sites linking to you) matter most: list Ebookvox on directories, ask authors and publishers to link to their book page, and share book links.
- Titles and descriptions are generated from each book's own details, so improve a book's description (in the Publisher) to improve its search listing.
