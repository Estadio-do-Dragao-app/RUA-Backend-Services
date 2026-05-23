#!/bin/bash


git submodule foreach '
  git checkout -B vm-changes &&
  git add . &&
  git diff --cached --quiet || git commit -m "vm changes" &&
  git push origin vm-changes &&
  git log origin/dev..vm-changes --oneline 2>/dev/null | grep -q . && \
    GH_TOKEN=ghp_o_teu_token_aqui gh pr create --base dev --head vm-changes \
    --title "VM Changes" --body "Alterações da VM" \
    --repo $(git remote get-url origin | sed "s/https:\/\/github.com\///") || \
    echo "Sem alterações em relação à dev, PR ignorado."
'

git add . && git commit -m "update submodule refs" && git push origin main