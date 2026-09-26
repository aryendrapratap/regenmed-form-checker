# Connecting the React frontend

The checker runs as a Python API (`api.py`). The React app sends it one PDF and shows the answer.

## 1. The API address

- On a laptop: run `uvicorn api:app --reload --port 8000`, then the address is `http://localhost:8000`
  (try it at `http://localhost:8000/docs`).
- Online: the Render link, e.g. `https://regenmed-api.onrender.com`

In the React project (Vite), create a file called `.env` next to `package.json`:

```
VITE_API_URL=http://localhost:8000
```

On Vercel or Netlify, add the same variable in the project's settings, with the Render link as the value.

## 2. Check a PDF

```js
const API = import.meta.env.VITE_API_URL;

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

## 3. What comes back

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

## 4. Correction note (optional button)

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

## 5. Errors

If the file isn't a PDF, or the AI is busy, `/api/check` returns an error with a `detail` message in plain words.
Show that message to the user.
