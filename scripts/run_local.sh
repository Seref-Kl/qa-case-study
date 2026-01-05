#!/bin/bash
echo "==> Running k6 REST"
k6 run k6/rest/restcountries-smoke.js || true

echo "==> Running k6 GraphQL"
k6 run k6/graphql/rickmorty-characters.js || true

echo "==> Setting up Python environment"
python3 -m pip install -U pip
pip3 install -r playwright-python/requirements.txt
python3 -m playwright install --with-deps chromium

echo "==> Running Playwright tests"
pytest --headed --video on --tracing on
