#!/usr/bin/env bash
# Run in Git Bash from INSIDE your repo folder (branch feature/yash-full-integration):
#   bash ~/alimony-files/finish-branch.sh ~/alimony-files
# Applies all patches in order (one commit each), checks the result against a known checksum, then offers to push.
set -Eeuo pipefail
P="${1:?usage: bash finish-branch.sh <folder-with-the-patch-files>}"
EXPECTED_FINAL=af127d9ca2
KNOWN_START_TREES="7b3786b229 da1241317a"      # mentor's main, or main plus the one-file rename
step=start
trap 'echo; echo "STOPPED at step: $step"; echo "Nothing was pushed. Copy everything above this line and send it to me."' ERR

need=(alimony-integration.patch alimony-rag-api.patch alimony-docker.patch alimony-cleanup.patch DOCKER.md
      alimony-celery.patch alimony-ci.patch alimony-docker-fixes.patch alimony-aws.patch alimony-case-delete.patch)
missing=0
for f in "${need[@]}"; do
  if [ -f "$P/$f" ]; then echo "found    $f"; else echo "MISSING  $f"; missing=1; fi
done
[ "$missing" -eq 0 ] || { echo; echo "Download the missing file(s) into $P and run again."; exit 1; }

step="checking the repository"
git rev-parse --is-inside-work-tree >/dev/null
branch=$(git rev-parse --abbrev-ref HEAD)
case "$branch" in main|master|HEAD) echo "You are on '$branch'. Switch to your feature branch first: git checkout feature/yash-full-integration"; exit 1 ;; esac
[ -z "$(git status --porcelain)" ] || { echo "Your working folder has uncommitted changes. Run 'git status' and send me the output."; exit 1; }
start_tree=$(git rev-parse 'HEAD^{tree}' | cut -c1-10)
case " $KNOWN_START_TREES " in
  *" $start_tree "*) echo "starting point recognised ($start_tree)" ;;
  *) echo "This branch does not start from the expected code (tree $start_tree)."
     echo "If you have no work to keep here, 'git fetch origin && git reset --hard origin/$branch' gives a clean start. Send me 'git log --oneline -5' first."
     exit 1 ;;
esac
git config core.autocrlf false          # keep LF line endings so patches apply exactly
echo "branch: $branch"

apply_commit() {                       # apply_commit "<commit message>" <patch>
  local msg="$1" patch="$2"
  step="applying $(basename "$patch")"
  git apply --index "$patch"
  step="committing: $msg"
  git commit -q -m "$msg"
  echo "done     $msg"
}

# 1. integration patch. It contains a rename (createPartycontroller.js -> createPartyController.js) that Windows
#    cannot apply, so that entry is skipped and the rename is done with git mv if it is not already in the branch.
step="applying alimony-integration.patch"
skip=(--exclude=backend/controllers/createPartycontroller.js --exclude=backend/controllers/createPartyController.js)
git apply --index "${skip[@]}" "$P/alimony-integration.patch"
if git ls-files --error-unmatch backend/controllers/createPartycontroller.js >/dev/null 2>&1; then
  git mv backend/controllers/createPartycontroller.js backend/controllers/tmp_party.js
  git mv backend/controllers/tmp_party.js backend/controllers/createPartyController.js
fi
step="committing the integration patch"
git commit -q -m "Add intake, document checklist, legal-route navigator and backend security hardening"
echo "done     integration"

apply_commit "Add FastAPI + pgvector legal search service"              "$P/alimony-rag-api.patch"
apply_commit "Add Docker setup: Dockerfiles, database init, Compose"    "$P/alimony-docker.patch"
apply_commit "Cleanup: remove dead duplicate route and compiled cache"  "$P/alimony-cleanup.patch"

step="adding docs/DOCKER.md"
mkdir -p docs && cp "$P/DOCKER.md" docs/DOCKER.md && git add docs/DOCKER.md
git commit -q -m "Add Docker run guide"; echo "done     docs/DOCKER.md"

apply_commit "Add Celery + Redis background document processing"        "$P/alimony-celery.patch"
apply_commit "Add CI workflow and helper scripts"                        "$P/alimony-ci.patch"
apply_commit "Docker fixes: Redis capabilities, LF line endings, notes"  "$P/alimony-docker-fixes.patch"
apply_commit "Add AWS deployment guide, manual ECR deploy workflow and post-deploy verification" "$P/alimony-aws.patch"
apply_commit "Delete a case together with everything that belongs to it" "$P/alimony-case-delete.patch"

step="final checks"
trap - ERR
final_tree=$(git rev-parse 'HEAD^{tree}' | cut -c1-10)
echo
echo "================ RESULT ================"
echo "working folder clean: $([ -z "$(git status --porcelain)" ] && echo yes || echo NO)"
echo "commits on this branch: $(git rev-list --count HEAD)"
echo "tree checksum: $final_tree   (expected: $EXPECTED_FINAL)"
if [ "$final_tree" != "$EXPECTED_FINAL" ]; then
  echo "The checksum does not match, so I will NOT offer to push. Send me this whole output."
  exit 1
fi
echo "Checksum matches."
echo "Will push branch '$branch' to: $(git remote get-url origin)"
echo "(that should be your fork, https://github.com/yashchauhan-01/Alimony-Plus.git; pull request #5 updates automatically)"
read -r -p "Push now? [y/N] " answer
if [ "$answer" = "y" ] || [ "$answer" = "Y" ]; then
  git push -u origin "$branch"
  echo "Pushed. Now tell me, and I will verify it on GitHub."
else
  echo "Not pushed. When ready: git push -u origin $branch"
fi
