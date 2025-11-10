import os
import pytest
from pathlib import Path
from datetime import datetime
from playwright.sync_api import sync_playwright

ARTIFACTS_DIR = Path(__file__).parent / "artifacts"
SCREENSHOTS_DIR = ARTIFACTS_DIR / "screenshots"
VIDEOS_DIR = ARTIFACTS_DIR / "videos"
TRACES_DIR = ARTIFACTS_DIR / "traces"
for d in (SCREENSHOTS_DIR, VIDEOS_DIR, TRACES_DIR):
    d.mkdir(parents=True, exist_ok=True)

BASE_URL = "https://www.saucedemo.com/"

@pytest.fixture(scope="session")
def browser():
    with sync_playwright() as p:
        # GitHub Actions CI ortamında CI="true" gelir.
        # Lokal: headed (pencere açık) / CI: headless
        headless = os.getenv("CI", "").lower() == "true" or os.getenv("PW_HEADLESS", "") in ("1", "true")
        browser = p.chromium.launch(headless=headless)
        yield browser
        browser.close()

@pytest.fixture(scope="function")
def context(browser):
    ctx = browser.new_context(ignore_https_errors=True, record_video_dir=str(VIDEOS_DIR))
    ctx.tracing.start(screenshots=True, snapshots=True, sources=True)
    yield ctx
    ctx.tracing.stop()
    ctx.close()

@pytest.fixture(scope="function")
def page(context):
    page = context.new_page()
    page.set_default_timeout(5000)
    yield page
    page.close()

@pytest.fixture
def do_login(page):
    def _login(username="standard_user", password="secret_sauce"):
        page.goto(BASE_URL)
        page.fill("[data-test='username']", username)
        page.fill("[data-test='password']", password)
        page.click("[data-test='login-button']")
    return _login

@pytest.hookimpl(hookwrapper=True, tryfirst=True)
def pytest_runtest_makereport(item, call):
    outcome = yield
    rep = outcome.get_result()
    setattr(item, f"rep_{rep.when}", rep)

@pytest.fixture(autouse=True)
def capture_on_failure(request, context, page):
    # Defer actions until after test
    yield
    failed = hasattr(request.node, "rep_call") and request.node.rep_call.failed
    nodeid = (
        request.node.nodeid
        .replace("::", "_")
        .replace("/", "_")
        .replace("\\", "_")
    )
    timestamp = datetime.utcnow().strftime("%Y%m%d-%H%M%S")
    if failed:
        try:
            page.screenshot(path=str(SCREENSHOTS_DIR / f"{nodeid}_{timestamp}.png"), full_page=True)
        except Exception:
            pass
        try:
            context.tracing.export(path=str(TRACES_DIR / f"{nodeid}_{timestamp}.zip"))
        except Exception:
            pass
    try:
        v = page.video
        if v:
            p = v.path()
            if not failed:
                Path(p).unlink(missing_ok=True)
    except Exception:
        pass
