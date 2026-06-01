#!/bin/bash
git submodule foreach 'git checkout main && git pull'

git pull origin main
