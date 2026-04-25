#!/bin/bash
set -e

SOURCE_REPO="francescobianco/github-growth"
TARGET_REPO="github-growth"
TARBALL_URL="https://github.com/${SOURCE_REPO}/archive/refs/heads/main.tar.gz"

echo "GitHub Growth - Get Started"
echo "==========================="

if ! command -v gh &>/dev/null; then
  echo "Error: gh CLI is required. Install it from https://cli.github.com"
  exit 1
fi

if ! gh auth status &>/dev/null; then
  echo "Error: not authenticated. Run: gh auth login"
  exit 1
fi

USER=$(gh api user --jq '.login')
echo "Logged in as: ${USER}"
echo ""

mapfile -t ORGS < <(gh api user/memberships/orgs --paginate --jq '.[] | select(.role == "admin") | .organization.login')

ACCOUNTS=("$USER (personal)")
ACCOUNT_LOGINS=("$USER")
for org in "${ORGS[@]}"; do
  ACCOUNTS+=("$org (organization)")
  ACCOUNT_LOGINS+=("$org")
done

echo "Where do you want to create the repo?"
echo ""
for i in "${!ACCOUNTS[@]}"; do
  printf "  [%d] %s\n" "$((i+1))" "${ACCOUNTS[$i]}"
done
echo ""

while true; do
  read -rp "Choose [1-${#ACCOUNTS[@]}]: " CHOICE
  if [[ "$CHOICE" =~ ^[0-9]+$ ]] && (( CHOICE >= 1 && CHOICE <= ${#ACCOUNTS[@]} )); then
    break
  fi
  echo "  Invalid choice, try again."
done

OWNER="${ACCOUNT_LOGINS[$((CHOICE-1))]}"
echo ""
echo "Creating repo under: ${OWNER}"

if gh api "repos/${OWNER}/${TARGET_REPO}" &>/dev/null; then
  echo "Error: repo '${OWNER}/${TARGET_REPO}' already exists"
  exit 1
fi

WORK_DIR=$(mktemp -d)
trap 'rm -rf "$WORK_DIR"' EXIT

echo "Downloading template from ${SOURCE_REPO}..."
curl -fsSL "$TARBALL_URL" | tar -xz -C "$WORK_DIR" --strip-components=1

echo "Creating repo ${OWNER}/${TARGET_REPO}..."
if [[ "$OWNER" == "$USER" ]]; then
  gh repo create "${TARGET_REPO}" --public --description "GitHub traffic growth tracker"
else
  gh repo create "${OWNER}/${TARGET_REPO}" --public --description "GitHub traffic growth tracker"
fi

cd "$WORK_DIR"
git init -b main
git add .
git commit -m "chore: initialize from ${SOURCE_REPO}"
git remote add origin "https://github.com/${OWNER}/${TARGET_REPO}.git"
git push -u origin main

echo ""
echo "Done! Your repo is ready at: https://github.com/${OWNER}/${TARGET_REPO}"
echo "Next: add your GH_TOKEN secret to enable traffic collection."
echo "  -> https://github.com/${OWNER}/${TARGET_REPO}/settings/secrets/actions/new"