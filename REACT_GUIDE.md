# Connecting the React frontend

The checker runs as a Python API (`api.py`). The React app sends it one PDF and shows the answer.

## 1. Put the React project in this repo

Everything lives in one GitHub repo and runs at one Render link.

1. Get the repo: `git clone https://github.com/aryendrapratap/regenmed-form-checker.git`
2. Copy your whole React project into it as a folder called **`web`** (without `node_modules`).
   The repo then looks like: `api.py`, `ai.py`, `rules.py`, ..., `web/package.json`, `web/src/...`
3. Open `web/.gitignore` and **delete the line `dist`** (or `build`), so the built site gets uploaded.

## 2. The API address

- **Online:** the React page and the API are on the same site, so the address is just `""` (nothing).
- **While developing on your laptop** (`npm run dev`): create `web/.env.development` with the Render link:

```
VITE_API_URL=https://YOUR-RENDER-LINK.onrender.com
```

## 3. Check a PDF

```js
const API = import.meta.env.VITE_API_URL || "";   // "" = same site (when running on Render)

export async function checkPdf(file) {
  const body = new FormData();
  body.append("file", file);                     // the File from <input type="file" accept=".pdf">
  const res = await fetch(`${API}/api/check`, { method: "POST", body });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Something went wrong. Please try again.");
  return data;
}
```

It takes about 20 to 30 seconds, so show a loading message ("Checking your form...").

## 4. What comes back

```json
{
  "form_type": "QS-F-049",
  "form_name": "QS-F-049 · Technical/Quality Review and Disposition Statement",
  "passed": false,
  "counts": { "errors": 1, "please_check": 0, "extra_notes": 0 },
  "problems": [
    {
      "page": 1, "section": "Reviewed By/Date", "row": "Item 3", "row_number": 3,
      "field": "Quality", "kind": "missing",
      "message": "Item 3, Quality: date missing (or write N/A).",
      "rule": "Reviewed By/Date (Technical and Quality): every row needs initials and a date, or N/A."
    }
  ],
  "pages": ["data:image/jpeg;base64,..."],
  "per_page": [{ "page": 1, "errors": 1, "please_check": 0 }],
  "seconds": 21.4
}
```

How to show it:

| Field | Show it as |
| --- | --- |
| `form_type` = `"UNKNOWN"` | "This doesn't look like one of the 4 RegenMed forms (MP-F-023, QS-F-049, Lot Log, Discard Form)." |
| `passed` | Green "Passed all checks" if true, red "N problems found" if false |
| `kind` = `missing`, `wrong_format`, `inconsistent` | Errors (red) |
| `kind` = `please_check` | "Please check" (yellow): the AI wasn't sure, a person should look |
| `kind` = `extra_note` | "Extra notes" (grey), beyond RegenMed's required checks |
| `page`, `section`, `row`, `field` | Where the problem is, e.g. "Page 2 · Item table · Sieve · Load #" |
| `rule` | Small text under each problem: why it was flagged |
| `pages` | `<img src={page} />` for each page picture |
| `per_page` | For a Discard PDF with several pages (one form per page): a result per page |

## 5. Correction note (optional button)

```js
export async function correctionNote(result) {
  const res = await fetch(`${API}/api/note`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ form_type: result.form_type, problems: result.problems }),
  });
  return (await res.json()).note;   // plain text, ready to copy
}
```

## 6. Errors

If the file isn't a PDF, or the AI is busy, `/api/check` returns an error with a `detail` message in plain words.
Show that message to the user.

## 7. Publish your changes

Every time you want the live site updated:

```
cd web
npm run build
cd ..
git add .
git commit -m "Update frontend"
git push
```

Render rebuilds automatically in 2 to 4 minutes. The Render link then shows the React page, and that is the link we submit.
