#!/bin/sh
set -eu

apk add --no-cache curl unzip >/dev/null

# Resolve version: use VOYAGER_VERSION env var, or fetch latest from GitHub
if [ -n "${VOYAGER_VERSION:-}" ] && [ "${VOYAGER_VERSION}" != "latest" ]; then
	echo "Using pinned Voyager version: ${VOYAGER_VERSION}"
else
	echo "Fetching latest Voyager release from GitHub..."
	VOYAGER_VERSION=$(curl -fsSL "https://api.github.com/repos/Smithsonian/dpo-voyager/releases/latest" \
		| grep '"tag_name"' | sed 's/.*"v\([^"]*\)".*/\1/')
	echo "Latest version: ${VOYAGER_VERSION}"
fi

VOYAGER_RELEASE_URL="https://github.com/Smithsonian/dpo-voyager/releases/download/v${VOYAGER_VERSION}/voyager-tools-v${VOYAGER_VERSION}.zip"
TARGET_DIR="${TARGET_DIR:-/app/static/voyager/${VOYAGER_VERSION}}"

if [ -f "${TARGET_DIR}/js/voyager-explorer.min.js" ]; then
	echo "Voyager runtime ${VOYAGER_VERSION} already installed at ${TARGET_DIR}"
	exit 0
fi

echo "Installing Voyager runtime ${VOYAGER_VERSION}"

TMP_DIR="$(mktemp -d)"
ZIP_PATH="${TMP_DIR}/voyager-tools.zip"
EXTRACT_DIR="${TMP_DIR}/extract"

mkdir -p "${EXTRACT_DIR}" "${TARGET_DIR}"

curl -fL "${VOYAGER_RELEASE_URL}" -o "${ZIP_PATH}"

unzip -q "${ZIP_PATH}" \
	'dist/3RD_PARTY_LICENSES.txt' \
	'dist/ATTRIBUTIONS.md' \
	'dist/LICENSE.md' \
	'dist/fonts/*' \
	'dist/images/*' \
	'dist/js/basis/*' \
	'dist/js/draco/*' \
	'dist/js/voyager-explorer.min.js' \
	'dist/js/voyager-explorer.min.js.LICENSE.txt' \
	'dist/language/*' \
	-d "${EXTRACT_DIR}"

cp -R "${EXTRACT_DIR}/dist/." "${TARGET_DIR}/"

rm -rf "${TMP_DIR}"

echo "Voyager runtime ${VOYAGER_VERSION} installed at ${TARGET_DIR}"
