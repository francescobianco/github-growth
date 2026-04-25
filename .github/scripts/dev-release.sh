#!/bin/bash
set -e

git pull --no-rebase

sh .github/scripts/dev-init.sh

git add .
git commit -am "Dev release" || true
git push
