#!/usr/bin/env bash
# scripts/knip-filter.sh
#
# Filter knip results by file paths or export/dependency names
# Usage: pnpm knip --reporter json --no-exit-code | bash scripts/knip-filter.sh pattern1 pattern2 ...

set -euo pipefail

# Read piped JSON input
input=$(cat)

# Get filter patterns from arguments
patterns=("$@")

if [ ${#patterns[@]} -eq 0 ]; then
  echo "Usage: knip --reporter json | bash scripts/knip-filter.sh pattern1 pattern2 ..."
  echo "Example: knip --reporter json | bash scripts/knip-filter.sh adapter crypto proxy"
  exit 1
fi

# Build pattern matching for jq
pattern_json=$(printf '%s\n' "${patterns[@]}" | jq -R . | jq -s .)

# Process knip JSON output
echo "$input" | jq -r --argjson patterns "$pattern_json" '
  # Helper function to check if text matches any pattern
  def matches_pattern:
    . as $text |
    ($patterns | map(ascii_downcase) | any(. as $pattern | $text | ascii_downcase | contains($pattern)));

  # Filter unused files
  def filter_files:
    .files // [] | map(select(. | matches_pattern));

  # Filter issues
  def filter_issues:
    .issues // [] | map(
      select(.file | matches_pattern)
    );

  # Build result
  {
    unused_files: filter_files,
    filtered_issues: filter_issues
  } |

  # ANSI color codes
  def yellow: "\u001b[1;33m";
  def reset: "\u001b[0m";

  # Format output to match knip native format
  if (.unused_files | length) > 0 or (.filtered_issues | length) > 0 then
    [
      (if (.unused_files | length) > 0 then
        "\n" + yellow + "Unused files (" + (.unused_files | length | tostring) + ")" + reset,
        (.unused_files | map("  " + .) | .[])
      else empty end),
      (
        (.filtered_issues | map(.file as $file | .dependencies // [] | map(. + {file: $file})) | flatten) as $all_deps |
        if ($all_deps | length) > 0 then
          "\n" + yellow + "Unused dependencies (" + ($all_deps | length | tostring) + ")" + reset,
          ($all_deps | map("  " + ((.name + (" " * (40 - (.name | length))))[0:40]) + "  " + .file + ":" + (.line | tostring) + ":" + (.col | tostring)) | .[])
        else empty end
      ),
      (
        (.filtered_issues | map(.file as $file | .devDependencies // [] | map(. + {file: $file})) | flatten) as $all_devdeps |
        if ($all_devdeps | length) > 0 then
          "\n" + yellow + "Unused devDependencies (" + ($all_devdeps | length | tostring) + ")" + reset,
          ($all_devdeps | map("  " + ((.name + (" " * (40 - (.name | length))))[0:40]) + "  " + .file + ":" + (.line | tostring) + ":" + (.col | tostring)) | .[])
        else empty end
      ),
      (
        (.filtered_issues | map(.file as $file | .exports // [] | map(. + {file: $file})) | flatten) as $all_exports |
        if ($all_exports | length) > 0 then
          "\n" + yellow + "Unused exports (" + ($all_exports | length | tostring) + ")" + reset,
          ($all_exports | map("  " + ((.name + (" " * (40 - (.name | length))))[0:40]) + "  " + .file + ":" + (.line | tostring) + ":" + (.col | tostring)) | .[])
        else empty end
      ),
      (
        (.filtered_issues | map(.file as $file | .types // [] | map(. + {file: $file})) | flatten) as $all_types |
        if ($all_types | length) > 0 then
          "\n" + yellow + "Unused types (" + ($all_types | length | tostring) + ")" + reset,
          ($all_types | map("  " + ((.name + (" " * (40 - (.name | length))))[0:40]) + "  " + .file + ":" + (.line | tostring) + ":" + (.col | tostring)) | .[])
        else empty end
      ),
      (
        (.filtered_issues | map(.file as $file | .unlisted // [] | map(. + {file: $file})) | flatten) as $all_unlisted |
        if ($all_unlisted | length) > 0 then
          "\n" + yellow + "Unlisted dependencies (" + ($all_unlisted | length | tostring) + ")" + reset,
          ($all_unlisted | map("  " + ((.name + (" " * (40 - (.name | length))))[0:40]) + "  " + .file + ":" + (.line | tostring) + ":" + (.col | tostring)) | .[])
        else empty end
      )
    ] | join("\n")
  else
    "No matches found for patterns: " + ($patterns | join(", "))
  end
'
