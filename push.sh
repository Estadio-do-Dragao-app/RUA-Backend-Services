#!/bin/bash
eval $(ssh-agent -s)
ssh-add ~/.ssh/PEI_key

git submodule foreach '
  git checkout -B vm-changes &&
  git add . &&
  git diff --cached --quiet || git commit -m "vm changes" &&
  git push origin vm-changes
  git checkout main
'

git add . && git commit -m "update submodule refs" && git push origin main