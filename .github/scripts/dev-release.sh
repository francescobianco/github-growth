#!/bin/bash
set -e

sh .github/scripts/dev-init.sh

git add .
git commit -am "Dev release" || true
git push
