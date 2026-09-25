#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPTS_DIR="${ROOT_DIR}/loadtest/scripts"
RESULTS_DIR="${ROOT_DIR}/loadtest/results"
BASE_URL="${BASE_URL:-http://localhost:80/api}"
K6_IMAGE="${K6_IMAGE:-grafana/k6:latest}"
TARGET="${1:-dev}"

mkdir -p "${RESULTS_DIR}"

run_k6() {
  local script="$1"
  local name
  name="$(basename "${script}" .js)"

  echo "=== k6: ${name} (TARGET=${TARGET}, BASE_URL=${BASE_URL}) ==="

  docker run --rm \
    --network host \
    --user "$(id -u):$(id -g)" \
    -e BASE_URL="${BASE_URL}" \
    -v "${SCRIPTS_DIR}":/scripts:ro \
    -v "${RESULTS_DIR}":/results \
    "${K6_IMAGE}" run \
    --summary-trend-stats="avg,p(90),p(95),max" \
    --out "json=/results/${TARGET}-${name}.json" \
    "/scripts/${name}.js"
}

main() {
  local cmd="${2:-all}"

  case "${cmd}" in
    stock)
      run_k6 "concurrency-stock.test.js"
      run_k6 "concurrency-update.test.js"
      run_k6 "concurrency-cancel.test.js"
      run_k6 "verify-stock.test.js"
      ;;
    smoke)
      run_k6 "smoke.test.js"
      ;;
    load)
      run_k6 "load.test.js"
      ;;
    spike)
      run_k6 "spike.test.js"
      ;;
    soak)
      run_k6 "soak.test.js"
      ;;
    concurrency)
      run_k6 "concurrency-stock.test.js"
      run_k6 "concurrency-update.test.js"
      run_k6 "concurrency-cancel.test.js"
      ;;
    all)
      run_k6 "smoke.test.js"
      run_k6 "concurrency-stock.test.js"
      run_k6 "concurrency-update.test.js"
      run_k6 "concurrency-cancel.test.js"
      run_k6 "load.test.js"
      run_k6 "spike.test.js"
      run_k6 "soak.test.js"
      ;;
    *)
      echo "Uso: $0 [dev|prod] [all|smoke|load|spike|soak|concurrency|stock]"
      exit 1
      ;;
  esac
}

main "$@"