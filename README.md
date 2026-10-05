# Companies Portfolio · Brazilian Pharma & Health (v2)

Investment directory for Brazilian health, biotech and pharma companies (Abiquifi + ApexBrasil).

## Current status: Step 0 (preparation)

| Folder | Contents |
|---|---|
| `original/` | Inputs received: bundled prototype (`Companies_Portfolio.html`) and the two B2H specs (`.docx`) |
| `docs/` | Specs converted to Markdown (`especificacao-perfil.md`, `especificacao-contatos.md`): the source of truth |
| `prototype-v1/` | The unpacked prototype, visually identical to the original (reference baseline) |
| `tools/unpack_bundle.py` | Script that unpacks the bundle (`python3 tools/unpack_bundle.py original/Companies_Portfolio.html prototype-v1`) |

## Running locally

You need a local HTTP server, because browsers block scripts and fonts on `file://`:

```bash
python3 -m http.server 8000
# open http://localhost:8000/prototype-v1/
```
