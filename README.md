# RegenMed Form Checker

Upload one scanned RegenMed form (MP-F-023, QS-F-049, Lot Log or the bonus Discard Form; a PDF may hold several Discard Forms, one per page). The app finds the form
type and lists anything missing or wrong, with the page, section, row and field.

| File | Owner | What it does |
| --- | --- | --- |
| `app.py` | Person 3 | The web page (Streamlit) |
| `ai.py` | Person 1 | Asks Gemini which form it is and reads every box |
| `rules.py` | Person 2 | PDF to pictures, and RegenMed's rules as Python |
| `try_ai.py` | Person 1 | Tests `ai.py` on a PDF from the terminal |

## Run it on your laptop

```
python -m venv .venv
.venv\Scripts\activate            # Windows   (Mac: source .venv/bin/activate)
pip install -r requirements.txt
copy .streamlit\secrets.toml.example .streamlit\secrets.toml   # Mac: cp ...
# open .streamlit/secrets.toml and paste the Gemini key
streamlit run app.py
```

Test only the AI part: `python try_ai.py samples/QS-F-049.PDF`
