#!/usr/bin/env bash
set -euo pipefail

TITLE="${1:-Claude Code 任务通知}"
PROJECT="${2:-daily-notes}"
BRANCH="${3:-unknown}"
COMMIT_HASH="${4:-unknown}"
PUSH_STATUS="${5:-成功}"
PR_URL="${6:-}"
FILES="${7:-未提供修改文件列表}"

if [ -z "${DINGTALK_WEBHOOK:-}" ]; then
  echo "DINGTALK_WEBHOOK missing"
  exit 1
fi

if [ -z "${DINGTALK_SECRET:-}" ]; then
  echo "DINGTALK_SECRET missing"
  exit 1
fi

TIMESTAMP="$(date +%s%3N)"
export TIMESTAMP

SIGN="$(python3 - <<'PY'
import hmac
import hashlib
import base64
import urllib.parse
import os

timestamp = os.environ["TIMESTAMP"]
secret = os.environ["DINGTALK_SECRET"]

string_to_sign = f"{timestamp}\n{secret}"
hmac_code = hmac.new(
    secret.encode("utf-8"),
    string_to_sign.encode("utf-8"),
    digestmod=hashlib.sha256
).digest()

sign = urllib.parse.quote_plus(base64.b64encode(hmac_code).decode("utf-8"))
print(sign)
PY
)"

URL="${DINGTALK_WEBHOOK}&timestamp=${TIMESTAMP}&sign=${SIGN}"

if [ -n "$PR_URL" ]; then
  PR_LINE="[点击查看 PR](${PR_URL})"
else
  PR_LINE="未提供 PR 地址"
fi

MARKDOWN_CONTENT="## ✅ ${TITLE}

---

**项目：** ${PROJECT}  
**分支：** \`${BRANCH}\`  
**Commit：** \`${COMMIT_HASH}\`  
**Push：** ✅ ${PUSH_STATUS}  

**PR：** ${PR_LINE}

### 修改文件

${FILES}

---

> Claude Code 自动通知"

python3 - <<PY | curl -s "$URL" -H 'Content-Type: application/json' -d @-
import json

payload = {
    "msgtype": "markdown",
    "markdown": {
        "title": "${TITLE}",
        "text": """${MARKDOWN_CONTENT}"""
    }
}

print(json.dumps(payload, ensure_ascii=False))
PY

echo
