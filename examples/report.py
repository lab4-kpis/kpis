import json
import os
import urllib.error
import urllib.request
import uuid


def required(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(f"{name} is required")
    return value


url = required("SUPABASE_URL").rstrip("/") + "/rest/v1/measurement?on_conflict=project_id,kpi_id,date,env"
body = json.dumps([
    {
        "kpi_id": "publicaciones_activas",
        "date": "2026-10-09",
        "env": "prod",
        "value": 42,
        "run_id": str(uuid.uuid4()),
    }
]).encode("utf-8")
request = urllib.request.Request(
    url,
    data=body,
    method="POST",
    headers={
        "apikey": required("SUPABASE_PUBLISHABLE_KEY"),
        "X-Project-Key": required("PROJECT_KEY"),
        "Content-Type": "application/json",
        "Prefer": "resolution=ignore-duplicates",
    },
)

try:
    with urllib.request.urlopen(request, timeout=15) as response:
        print(response.status)
except urllib.error.HTTPError as error:
    raise RuntimeError(f"KPI report failed ({error.code}): {error.read().decode('utf-8')}") from error
