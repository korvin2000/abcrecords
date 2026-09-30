# Server setup guide — step by step

A beginner's walkthrough for putting the application's server side in place:
the three PHP scripts, the `.htaccess` rules and the optional PDF page images.
It assumes nothing beyond being able to log in to the hosting account.

Reference material (contracts, internals, every option) lives in
[`server/README.md`](../server/README.md); the reasons behind each piece are in
[`performance-analysis.md`](performance-analysis.md) §10. This guide is only the
*how*.

> **Nothing here is required for the site to work.** The app runs without
> `facts.php`, `log.php` and the `.htaccess` rules — they make it faster and
> easier to diagnose. If a step goes wrong, undo that step and the site is
> exactly as it was.

---

## 0. The map — what goes where

Your hosting account has one folder that the web server shows to the world. It
is usually called `public_html`, `htdocs`, `www` or `httpdocs`. This guide calls
it the **site root**: the folder whose `index.html` opens at
`https://www.abc-guitars.com/`.

| File in the repository | Where it goes on the server | Opens as |
|---|---|---|
| everything inside `apps/guitar-codex/dist/` (after `npm run build`) | the site root | `https://www.abc-guitars.com/` |
| `server/counter.php` | `counter/counter.php` | `/counter/counter.php` |
| `server/facts.php` | `api/facts.php` | `/api/facts.php` |
| `server/log.php` | `api/log.php` | `/api/log.php` |
| `server/htaccess/root.htaccess` | **pasted into** the existing `.htaccess` in the site root | — |
| `server/htaccess/immutable.htaccess` | already inside `dist/assets/.htaccess` and `dist/pdfjs/.htaccess` — uploaded with the build | — |
| `<issue>.pages/` folders made by `npm run prerender:pdf` | next to the PDF they belong to, e.g. `magazine/2017/` | — |

After everything is uploaded the site root looks like this (only the parts this
guide touches):

```text
site root/
├─ .htaccess                 ← the legacy site's file, with our block added
├─ index.html  index.json  index-ru.json …
├─ ru/  en/  de/ …           ← the entries (*.bio.json, *.bio.md)
├─ assets/
│  ├─ .htaccess              ← comes with the build
│  └─ index-….js  …
├─ pdfjs/
│  ├─ .htaccess              ← comes with the build
│  └─ cmaps/ wasm/ …
├─ api/
│  ├─ facts.php
│  ├─ log.php
│  ├─ facts-cache/           ← created by facts.php on first use
│  └─ log-data/              ← created by log.php on first use
├─ counter/
│  ├─ counter.php
│  └─ counter-data/          ← created by counter.php on first use
└─ magazine/2017/
   ├─ IGvL_2(21)_2017.pdf
   └─ IGvL_2(21)_2017.pages/ ← optional page images
```

---

## 1. Before you start

### 1.1 Tools

- **A way to upload files.** Either the hosting panel's *File Manager*, or an
  FTP/SFTP program such as FileZilla or WinSCP (both free). The host's welcome
  e-mail has the server name, user name and password.
- **A plain-text editor** for the two small edits in this guide: Notepad++,
  VS Code, or the File Manager's built-in editor. **Not Word**, and preferably
  not Windows Notepad — see "encoding" below.
- **A way to look at what the server answers.** Any browser will do (§9.1).
  The `curl` commands in this guide are optional shortcuts; on Windows 10/11
  type `curl.exe` instead of `curl` in PowerShell.

### 1.2 Three things that trip up beginners

1. **Hidden files.** A name that begins with a dot — `.htaccess` — is hidden by
   default. Turn hidden files on, or you will neither see the existing file nor
   notice that yours was not uploaded:
   - FileZilla: *Server → Force showing hidden files*.
   - WinSCP: *Options → Preferences → Panels → Show hidden files*.
   - cPanel File Manager: *Settings → Show Hidden Files (dotfiles)*.
   - Windows Explorer (for the `dist` folder on your PC): *View → Hidden items*.
2. **Encoding.** PHP files must be saved as **UTF-8 without BOM**. A BOM is
   three invisible bytes some editors put at the start of a file; in front of
   `<?php` they are sent to the browser before the script can set its headers,
   and the script fails with "headers already sent". If you only change the
   one line this guide asks for, in Notepad++ or VS Code, nothing changes. If
   in doubt: Notepad++ → *Encoding* → *UTF-8* (not "UTF-8-BOM").
3. **Transfer mode.** Leave the FTP program on *Auto* or *Binary*. Never force
   *ASCII* mode for images, fonts, `.wasm` or PDF files — it corrupts them.

### 1.3 Make a backup first

Download a copy of the site root's current `.htaccess` to your computer and
name it `htaccess-backup-<date>.txt`. It is the one file here that can take the
whole site down if it is broken, and restoring the copy fixes that in seconds.

---

## 2. Permissions ("attributes") in plain words

Every file and folder on the server has a three-digit number that says who may
read, change or enter it. You set it in the FTP program with *right-click →
File permissions…* (FileZilla) or *Properties* (WinSCP), or in the File Manager
with *Permissions* / *Change permissions*.

| What | Number | Meaning |
|---|---|---|
| Every **file**: `.php`, `.htaccess`, `.json`, `.js`, images, PDFs | **644** | you may write, everyone may read |
| Every **folder**: `api/`, `counter/`, `assets/`, `magazine/…` | **755** | you may write, everyone may enter and read |
| The three **data folders** the scripts create: `api/facts-cache/`, `api/log-data/`, `counter/counter-data/` | **755** normally | see below |

These are what an upload produces by default on almost every host, so usually
there is **nothing to change** — check, do not guess.

Rules worth remembering:

- **PHP files do not need to be "executable".** 644 is correct. They are run by
  the server, not started like a program.
- **Never use 777 (or 666) as a first resort.** On modern hosts PHP runs *as
  your own account*, so 755 folders are already writable by the scripts — and
  many such hosts deliberately refuse to run anything inside a 777 folder and
  answer **500 Internal Server Error** instead.
- **Only if a self-test says a data folder is not writable** (§4.3, §5.3):
  create that folder by hand, set it to **775**, and run the self-test again.
  If it still fails, ask the host "which user does PHP run as, and how do I
  give it write access to one folder?" — that is a one-line answer for them.
  777 is the last resort, and only on those three data folders, which hold no
  personal data and are closed to the web by their own `.htaccess`.
- **Owner.** Files uploaded through your own FTP login belong to you, which is
  what is wanted. Nothing to set.

---

## 3. Upload the application

1. On your computer, in the repository folder, build the site:

   ```bash
   npm run verify
   ```

   It must end with `lazy boundary intact` and `pdf/build check passed`. The
   result is the folder `apps/guitar-codex/dist/`.
2. Upload **the contents of `dist/`** (not the folder itself) into the site
   root, overwriting what is there.
3. Check that the two dotfiles arrived: `assets/.htaccess` and
   `pdfjs/.htaccess` must exist on the server (hidden files on, §1.2).
4. Open the site. It must look and work as before.

Old files with other hash names in `assets/` should stay for a few days: a
reader with the site already open, or with the previous `index.html` still in
their browser's cache, will ask for them. Delete them at the next deploy.

---

## 4. Install `facts.php`

*What it does:* instead of the browser fetching 736 small `*.bio.json` files to
learn everyone's names and dates, it fetches one answer from this script.

### 4.1 Upload

1. In the site root create a folder named `api` (755).
2. Upload `server/facts.php` into it (644).

### 4.2 Configure

Normally **nothing**. The script assumes the language folders (`ru/`, `en/`, …)
are in the folder *above* `api/` — the site root — which is where the build
puts them. One copy of the script serves one site: a second copy of the app
in a sub-folder (say `/fable/`) with its own entries needs its own
`/fable/api/facts.php`.

Only if your entries live somewhere else, open `facts.php`, find the block
headed `CONFIGURATION` near the top and change one line:

```php
'content_dir' => dirname(__DIR__),          // default: the folder above /api/
'content_dir' => '/home/youraccount/public_html',   // or an absolute path
```

### 4.3 Test

Open this address in a browser:

```text
https://www.abc-guitars.com/api/facts.php?a=selftest
```

You should see a block of text in curly braces (JSON). Read four things in it:

| Look for | Good | If not |
|---|---|---|
| `"ok"` | `true` | read `"advice"` at the end — it says what is wrong in a sentence |
| `"languages"` | every language with a number, e.g. `"ru":736` | empty ⇒ `content_dir` points at the wrong folder (§4.2) |
| `"cache_dir_writable"` | `true` | see §2, "only if a self-test says…" — the script still works, only slower |
| `"advice"` | `Installation looks healthy.` | follow what it says |

Then open the real thing:

```text
https://www.abc-guitars.com/api/facts.php?lang=ru
```

It must show JSON beginning with `{"v":1,"lang":"ru","count":…`.

**What you should *not* see:**

- The PHP source code itself (`<?php …`) ⇒ PHP is not switched on for this
  folder; ask the host.
- A white page or "500 Internal Server Error" ⇒ §10.
- "404 Not Found" ⇒ the file is not where the address says: check the folder
  name (`api`, lower case) and the file name.

### 4.4 Finish

When testing is done, open `facts.php` once more and empty the list of
development addresses, so only your own site may read the endpoint from a
browser script:

```php
'allow_origins' => array(),
```

---

## 5. Install `log.php`

*What it does:* when the app fails on somebody's phone — a document that will
not open, a page that will not draw — it sends one short line here, so the
reason can be read later instead of guessed.

### 5.1 Upload

Upload `server/log.php` into the same `api` folder (644).

### 5.2 Configure — one line is required

Open `log.php`, find the `CONFIGURATION` block and replace the secret with any
long random text of your own (letters and digits, 30 characters or more):

```php
'secret' => 'put-your-own-long-random-text-here-2f9a7c41d0',
```

Also check `'timezone'` (default `Europe/Berlin`) — it is only the clock used
for the time stamp on each line.

### 5.3 Test

```text
https://www.abc-guitars.com/api/log.php?a=selftest
```

| Look for | Good |
|---|---|
| `"ok"` | `true` |
| `"secret_changed"` | `true` |
| `"data_dir_writable"`, `"write_probe"`, `"flock"` | all `true` |
| `"advice"` | `Installation looks healthy.` (a note that APCu is missing is harmless) |

To see a report arrive, send one by hand (optional):

In Git Bash, Linux or macOS:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST -d '{"where":"test","name":"Test","message":"hello"}' https://www.abc-guitars.com/api/log.php
```

In Windows PowerShell (the quoting rules differ, so use this form instead):

```powershell
(Invoke-WebRequest -Method Post -Uri https://www.abc-guitars.com/api/log.php -Body '{"where":"test","name":"Test","message":"hello"}').StatusCode
```

It must print `204`. Opening `log.php` directly in a browser shows
`405 Method Not Allowed` — that is correct, it only accepts reports.

### 5.4 Reading the log

Reports are collected in `api/log-data/client-errors.log`, one line each. The
folder is closed to the web on purpose, so **download the file with FTP** and
open it in a text editor. A line looks like:

```text
{"time":"2026-10-02T18:41:07+02:00","where":"pdf.open","name":"UnknownErrorException","message":"…","page":"#/IGvL_2(21)_2017","ua":"Mozilla/5.0 (Linux; Android 9; …) Chrome/138…"}
```

`where` says what failed, `message` is the engine's own explanation, and `ua`
tells you the browser and its version. The file is kept under ~1 MB
automatically. No IP address is stored.

### 5.5 Finish

As with `facts.php`: set `'allow_origins' => array(),` when testing is done.

---

## 6. `counter.php`

Already installed if the visitor counter in the top bar shows a number. For a
fresh install follow `server/README.md`, section A — it is the same routine:
upload to `counter/counter.php`, set your own `secret`, open
`/counter/counter.php?a=selftest`.

---

## 7. The `.htaccess` rules

`.htaccess` is a text file of instructions for the web server, applied to the
folder it sits in and everything below. We use it for two things: **compress**
text files on the way out, and tell browsers **how long they may keep** a file.

### 7.1 `assets/` and `pdfjs/` — nothing to do

The build already put a small `.htaccess` into both folders (§3, step 3). It
says: "these files never change — keep them for a year".

### 7.2 The site root — add, never replace

The site root already has an `.htaccess` that belongs to the old site. **Do not
upload ours over it.** Instead:

1. Make the backup (§1.3) if you have not yet.
2. Open the server's `.htaccess` in the editor.
3. Open `server/htaccess/root.htaccess` from the repository, copy everything
   from the first `<IfModule mod_deflate.c>` to the last `</IfModule>`.
4. Paste it at the **end** of the server's file. Save (644).
5. **Immediately** open the site in a browser.
   - It works ⇒ done.
   - "500 Internal Server Error" on every page ⇒ the server does not accept
     one of the lines. Upload your backup over the file — the site is back —
     and see §10.

If the root has no `.htaccess` at all, create an empty file with that exact
name (the dot, no `.txt` ending) and paste the block into it.

What the block does:

| Rule | Effect |
|---|---|
| `AddOutputFilterByType DEFLATE application/json text/markdown …` | the catalogue index and the articles travel compressed — `index.json` shrinks from ~223 KB to ~25 KB |
| `Cache-Control "no-cache"` for `.json`, `.md` and `.html` | the browser asks "has it changed?" each time and gets a tiny "no" — so an edited entry, or a new build, shows at once, and unchanged files are not downloaded again |
| `Cache-Control "public, max-age=2592000"` for photos and PDFs | kept for 30 days without asking |

---

## 8. Optional — PDF page images for phones

Large magazine scans (40–60 MB) are too heavy for many phones to read as PDF.
The app can show the same issue as ordinary page pictures when a folder of
them lies next to the PDF.

1. Put the PDF on your computer and run, in the repository folder:

   ```bash
   npm run prerender:pdf -- "C:/path/to/IGvL_2(21)_2017.pdf"
   ```

   A folder `IGvL_2(21)_2017.pages` appears beside the PDF, holding
   `manifest.json` and `p-001.jpg`, `p-002.jpg`, …
2. Upload that whole folder to the server **into the same folder as the PDF**
   (e.g. `magazine/2017/`). Folders 755, files 644.
3. Test: open
   `https://www.abc-guitars.com/magazine/2017/IGvL_2(21)_2017.pages/manifest.json`
   — it must show a short line of JSON, not an error page.

From then on the app opens that issue as images on weak devices, for files
over 20 MB, and whenever the PDF engine cannot open the file; the toolbar has a
button to switch between the two readers. Nothing else needs configuring. If
the PDF is ever replaced, run the command again and upload the new folder —
the page images carry a revision stamp, so readers get the new ones at once.
The PDF file itself may be kept by browsers for up to 30 days (the cache rule
in §7.2); give a replaced PDF a new file name if that matters.

---

## 9. How to check that everything works

### 9.1 In the browser (no tools needed)

1. Open the site in Chrome, Edge or Firefox and press **F12**.
2. Choose the **Network** tab, tick **Disable cache**, reload the page
   (**F5**) and wait ten seconds.
3. Check:

| Look at | Expected |
|---|---|
| A row named `facts.php?lang=ru` | Status `200`. There are **not** hundreds of `….bio.json` rows any more |
| Click `index.json` → *Headers* → *Response Headers* | `content-encoding: gzip` and `cache-control: no-cache` |
| Click any `assets/….js` | `cache-control: public, max-age=31536000, immutable` |
| Untick *Disable cache*, reload | `facts.php` and `index.json` now show status `304` (a few hundred bytes each) |
| The **Console** tab | no red errors |

If `facts.php` does not appear and the `.bio.json` rows are back, the script
did not answer in time and the app quietly used the old way — open
`/api/facts.php?lang=ru` directly to see why.

### 9.2 With `curl` (optional)

```bash
curl -sI -H "Accept-Encoding: gzip" https://www.abc-guitars.com/index.json
```

must list `Content-Encoding: gzip` and `Cache-Control: no-cache`.

```bash
curl -s "https://www.abc-guitars.com/api/facts.php?a=selftest"
```

must end with `Installation looks healthy.`

### 9.3 Checklist

| # | Address | Expected |
|---|---|---|
| 1 | `/` | the site |
| 2 | `/api/facts.php?a=selftest` | `"ok":true` |
| 3 | `/api/facts.php?lang=ru` | `{"v":1,"lang":"ru",…` |
| 4 | `/api/facts.php?lang=xx` | `{"error":"unknown language"}` |
| 5 | `/api/log.php?a=selftest` | `"ok":true`, `"secret_changed":true` |
| 6 | `/api/log.php` | `405` |
| 7 | `/api/facts-cache/` and `/api/log-data/client-errors.log` | `403 Forbidden` — the data folders are closed |
| 8 | `/counter/counter.php?a=selftest` | `Installation looks healthy.` |
| 9 | `index.json` response headers | `gzip`, `no-cache` |
| 10 | any `assets/*.js` response headers | `immutable` |

---

## 10. When something goes wrong

| What you see | Most likely cause | What to do |
|---|---|---|
| **500 on every page** right after editing the root `.htaccess` | the server does not allow one of the directives | restore the backup. Then add the block back in two halves — first the `mod_deflate` part, test, then the `mod_headers` part — to find which one, and ask the host to allow it (`AllowOverride FileInfo`). The compression line needs **both** `mod_deflate` and `mod_filter` |
| **500 on one PHP script** | a BOM or stray character in front of `<?php`; a broken quote in the line you edited; folder set to 777 on a host that forbids it | re-upload the original file and redo the one edit in a proper editor; set folders back to 755. The exact reason is in the host's **PHP error log** (hosting panel → *Errors* / *Logs*) |
| The browser shows **the PHP code** | PHP is not enabled for the folder | ask the host; nothing in the files will fix it |
| **404** for `/api/facts.php` | wrong folder or file name, or upper/lower case | names are case-sensitive on the server: `api`, `facts.php` |
| **403** for `/api/facts.php` | file is not 644, or folder is not 755 | fix the numbers (§2) |
| Self-test: `"languages":{}` | `content_dir` wrong | §4.2 |
| Self-test: `cache_dir_writable` / `data_dir_writable` is `false` | PHP may not write beside the script | §2, the 775 step |
| Self-test: `"php_ok":false` | PHP older than 7.2 | hosting panel → *PHP version* → choose 7.3 or newer |
| No `content-encoding: gzip` on `index.json` | `mod_deflate` missing or not allowed | ask the host to enable it. (`facts.php` compresses its own answer regardless) |
| No `cache-control` on `assets/*.js` | the two `.htaccess` files were not uploaded (hidden!), or `mod_headers` is off | check §3 step 3; otherwise ask the host for `mod_headers` |
| You fixed an entry but the search still finds the old name | the browser is showing a cached page, or the edit went to a different language folder than the one being searched | reload with Ctrl+F5; check which `<lang>/` folder the file is in. (`facts.php` notices any file whose date or size changed, on the very next request) |
| `.htaccess` was saved as `.htaccess.txt` | Windows added an ending | rename it on the server; turn on "file name extensions" in Explorer |

"Ask the host" is a normal step, not a failure. A message that works:

> Please confirm that for my account `mod_deflate`, `mod_filter` and `mod_headers` are
> enabled and may be used from `.htaccess` (AllowOverride FileInfo), and tell
> me which PHP version is active and where the PHP error log is.

---

## 11. Safety notes

- Change the `secret` in `log.php` and `counter.php`. Do not reuse a password.
- Empty `allow_origins` in all three scripts once testing is over.
- The data folders protect themselves (each script writes a deny `.htaccess`
  and an empty `index.html` into its folder). Checklist row 7 verifies it.
- Do not leave folders at 777.
- Keep the `.htaccess` backup until the site has run for a few days.

## 12. Undoing any step

| To remove | Do this |
|---|---|
| `facts.php` | delete the file — the app notices and reads the entries one by one again |
| `log.php` | delete the file — failures are simply no longer reported |
| the root rules | delete the pasted block, or restore the backup |
| page images | delete the `.pages` folder — the PDF opens in the normal viewer |

To switch a feature off in the app itself rather than on the server, set its
endpoint to an empty string in `apps/guitar-codex/src/config.ts`
(`DOSSIER.endpoint`, `DIAGNOSTICS.endpoint`) or `PDF.lite` to `false`, and
rebuild.
