#!/bin/bash


# Para cada submodule com alterações
git submodule foreach '
  git checkout -b vm-changes &&
  git add . &&
  git diff --cached --quiet || git commit -m "vm changes" &&
  git push origin vm-changes &&
  git checkout main
'

# Depois atualiza o repo principal
git add . && git commit -m "update submodule refs" && git push origin main